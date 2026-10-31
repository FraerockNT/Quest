import asyncio
import hashlib
import hmac
import json
import logging
import math
import os
import re
import secrets
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qsl

from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

# ───────────── Настройки (берутся из переменных окружения) ─────────────
# ВАЖНО: токен больше НЕ лежит в коде. Задай его в настройках хостинга: BOT_TOKEN=...
BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://quest123.bothost.tech")
ADMIN_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "5237959867").split(",") if x.strip()]
DEV = os.environ.get("DEV") == "1"  # режим проверки в обычном браузере (в проде не включать!)

BASE = Path(__file__).parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE / "data"))
DATA_FILE = DATA_DIR / "db.json"

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("quest")

# Максимум баллов за каждый тип задания (сервер не даст больше)
TASK_MAX = {
    "hanoi": 30, "snake": 20, "quiz": 20, "math": 50, "wordle": 50, "lock": 40,
    "match": 30, "simon": 30, "memory": 30, "slide": 40, "riddle": 40,
}
HINT_RATE = 0.3  # подсказка стоит 30% от максимума за задание
PRIVATE_CFG = {"answer"}  # эти поля настроек никогда не отправляются участникам

DB = {"rooms": {}}


class ApiError(Exception):
    pass


# ───────────── Хранилище ─────────────
def load_db():
    global DB
    try:
        DB = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        DB.setdefault("rooms", {})
    except FileNotFoundError:
        DB = {"rooms": {}}
    except Exception:
        log.exception("Не удалось прочитать базу, начинаю с пустой")
        DB = {"rooms": {}}


def save_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(DB, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, DATA_FILE)  # запись «всё или ничего», файл не побьётся


# ───────────── Проверка, что запрос пришёл из Telegram ─────────────
def check_init_data(init_data: str):
    if DEV and init_data.startswith("dev:"):
        uid = int(init_data.split(":")[1] or 0)
        return {"id": uid, "first_name": f"Тест{uid}"}
    try:
        pairs = dict(parse_qsl(init_data, keep_blank_values=True))
        recv_hash = pairs.pop("hash", None)
        if not recv_hash or not BOT_TOKEN:
            return None
        check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calc = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calc, recv_hash):
            return None
        if time.time() - int(pairs.get("auth_date", 0)) > 7 * 86400:
            return None
        return json.loads(pairs["user"])
    except Exception:
        return None


def is_admin(user):
    return int(user["id"]) in ADMIN_IDS


def now_ms():
    return int(time.time() * 1000)


def display_name(user):
    return (f"{user.get('first_name', '')} {user.get('last_name', '')}").strip() or "Игрок"


# ───────────── Помощники ─────────────
FAILS = {}  # защита от подбора кодов: uid -> время неудачных попыток


def rate_check(uid):
    t = time.time()
    FAILS[uid] = [x for x in FAILS.get(uid, []) if t - x < 60]
    if len(FAILS[uid]) >= 8:
        raise ApiError("Слишком много неверных попыток. Подожди минуту.")


def rate_fail(uid):
    FAILS.setdefault(uid, []).append(time.time())


def get_room(b):
    room = DB["rooms"].get(str(b.get("roomId", "")))
    if not room:
        raise ApiError("Комната не найдена")
    return room


def get_team(room, user):
    key = room["members"].get(str(user["id"]))
    team = room["teams"].get(key) if key else None
    if not team:
        raise ApiError("Вы не участник этой комнаты")
    return team


def get_task(room, b):
    task = next((t for t in room["tasks"] if t["id"] == b.get("taskId")), None)
    if not task:
        raise ApiError("Задание не найдено")
    return task


def check_open(room):
    n = now_ms()
    if n < room["start"]:
        raise ApiError("Квест ещё не начался")
    if n > room["end"]:
        raise ApiError("Время квеста истекло")


def hint_penalty(ttype):
    return math.ceil(TASK_MAX[ttype] * HINT_RATE)


def team_total(team):
    return sum(t.get("score", 0) for t in team["tasks"].values() if t.get("solved"))


def norm_answer(s):
    return "".join(ch for ch in str(s).lower().replace("ё", "е") if ch.isalnum())


def norm_word(s):
    return "".join(ch for ch in str(s).upper().replace("Ё", "Е") if ch.isalpha())


def wordle_attempts(n):
    return 5 if n <= 6 else 7 if n <= 9 else 9 if n <= 12 else 10


def wordle_marks(guess, secret):
    marks = [0] * len(secret)  # 0 нет, 1 есть в слове, 2 на своём месте
    pool = Counter()
    for i, (g, s) in enumerate(zip(guess, secret)):
        if g == s:
            marks[i] = 2
        else:
            pool[s] += 1
    for i, g in enumerate(guess):
        if marks[i] == 0 and pool[g] > 0:
            marks[i] = 1
            pool[g] -= 1
    return marks


def public_cfg(task):
    return {k: v for k, v in task.get("cfg", {}).items() if k not in PRIVATE_CFG}


# ───────────── Методы API ─────────────
HANDLERS = {}


def handler(name):
    def deco(fn):
        HANDLERS[name] = fn
        return fn
    return deco


@handler("me")
def h_me(user, b):
    admin = is_admin(user)
    uid = str(user["id"])
    rooms = []
    for r in DB["rooms"].values():
        joined = uid in r["members"]
        if admin or joined:
            team = r["teams"].get(r["members"].get(uid, ""))
            rooms.append({"id": r["id"], "name": r["name"], "start": r["start"], "end": r["end"],
                          "joined": joined, "team": team["name"] if team else ""})
    rooms.sort(key=lambda x: x["start"], reverse=True)
    return {"admin": admin, "rooms": rooms, "now": now_ms()}


@handler("join")
def h_join(user, b):
    pw = str(b.get("password", "")).strip().upper()
    team_name = " ".join(str(b.get("team", "")).split())[:24]
    room = next((r for r in DB["rooms"].values() if r["password"] == pw), None)
    if not room:
        raise ApiError("Комната с таким паролем не найдена")
    uid = str(user["id"])
    if uid in room["members"]:
        return {"roomId": room["id"]}
    check_open(room)
    if len(team_name) < 2:
        raise ApiError("Введите название команды (минимум 2 символа)")
    key = team_name.lower()
    team = room["teams"].setdefault(key, {"name": team_name, "members": {}, "tasks": {}})
    team["members"][uid] = display_name(user)
    room["members"][uid] = key
    save_db()
    return {"roomId": room["id"]}


@handler("room")
def h_room(user, b):
    room = get_room(b)
    team = get_team(room, user)
    tasks = []
    for i, t in enumerate(room["tasks"]):
        tt = team["tasks"].get(t["id"], {})
        if tt.get("solved"):
            state = "failed" if tt.get("raw", 0) == 0 else "solved"
        elif tt.get("found"):
            state = "found"
        else:
            state = "new"
        item = {"id": t["id"], "n": i + 1, "state": state, "x": t.get("x"), "y": t.get("y")}
        if state != "new":
            item["type"] = t["type"]
            item["title"] = t.get("title", "")
            item["hint"] = bool(tt.get("hint"))
            item["penaltyValue"] = hint_penalty(t["type"])
        if tt.get("solved"):
            item["score"] = tt.get("score", 0)
            item["penalty"] = tt.get("penalty", 0)
        tasks.append(item)
    board = [{"name": tm["name"], "score": team_total(tm),
              "solved": sum(1 for x in tm["tasks"].values() if x.get("solved")),
              "you": tm is team} for tm in room["teams"].values()]
    board.sort(key=lambda x: -x["score"])
    return {"id": room["id"], "name": room["name"], "start": room["start"], "end": room["end"],
            "now": now_ms(), "map": room.get("map", ""), "team": team["name"],
            "members": list(team["members"].values()), "tasks": tasks, "board": board,
            "total": team_total(team)}


@handler("unlock")
def h_unlock(user, b):
    room = get_room(b)
    team = get_team(room, user)
    check_open(room)
    uid = user["id"]
    rate_check(uid)
    code = "".join(ch for ch in str(b.get("code", "")) if ch.isdigit())
    task = next((t for t in room["tasks"] if t["code"] == code), None)
    if not task:
        rate_fail(uid)
        raise ApiError("Такого кода нет. Проверь цифры!")
    tt = team["tasks"].setdefault(task["id"], {})
    if tt.get("solved"):
        return {"taskId": task["id"], "state": "solved"}
    if not tt.get("found"):
        tt["found"] = True
        tt["found_at"] = now_ms()
        save_db()
    return {"taskId": task["id"], "state": "found"}


@handler("task_open")
def h_task_open(user, b):
    room = get_room(b)
    team = get_team(room, user)
    check_open(room)
    task = get_task(room, b)
    tt = team["tasks"].get(task["id"], {})
    if not tt.get("found"):
        raise ApiError("Сначала найдите код этого задания")
    if tt.get("solved"):
        raise ApiError("Это задание уже выполнено")
    progress = dict(tt.get("progress", {}))
    progress["wrong"] = tt.get("wrong", 0)
    cfg = public_cfg(task)
    if task["type"] == "wordle":
        secret = norm_word(task["cfg"].get("answer", "КВЕСТ")) or "КВЕСТ"
        progress["guesses"] = tt.get("guesses", [])
        progress["length"] = len(secret)
        progress["max"] = wordle_attempts(len(secret))
    return {"type": task["type"], "title": task.get("title", ""), "cfg": cfg, "progress": progress,
            "hintUsed": bool(tt.get("hint")), "penalty": hint_penalty(task["type"]),
            "max": TASK_MAX[task["type"]]}


@handler("progress")
def h_progress(user, b):
    room = get_room(b)
    team = get_team(room, user)
    task = get_task(room, b)
    tt = team["tasks"].get(task["id"])
    if not tt or not tt.get("found") or tt.get("solved"):
        raise ApiError("Нельзя сохранить прогресс")
    data = b.get("progress")
    if not isinstance(data, dict) or len(json.dumps(data)) > 4000:
        raise ApiError("Слишком большой прогресс")
    tt["progress"] = data
    save_db()
    return {"ok": True}


@handler("hint")
def h_hint(user, b):
    room = get_room(b)
    team = get_team(room, user)
    check_open(room)
    task = get_task(room, b)
    tt = team["tasks"].get(task["id"])
    if not tt or not tt.get("found"):
        raise ApiError("Сначала найдите код этого задания")
    if not tt.get("hint") and not tt.get("solved"):
        tt["hint"] = True  # запоминаем навсегда: штраф спишется один раз, повторный просмотр бесплатный
        save_db()
    return {"hint": task.get("hint", ""), "penalty": hint_penalty(task["type"])}


@handler("check")
def h_check(user, b):
    """Проверка ответа на сервере: правильный ответ никогда не попадает на устройство игрока."""
    room = get_room(b)
    team = get_team(room, user)
    check_open(room)
    task = get_task(room, b)
    tt = team["tasks"].get(task["id"])
    if not tt or not tt.get("found") or tt.get("solved"):
        raise ApiError("Задание недоступно")
    answer = b.get("answer", "")
    if task["type"] == "riddle":
        variants = [norm_answer(a) for a in str(task["cfg"].get("answer", "")).split("|") if norm_answer(a)]
        ok = norm_answer(answer) in variants
        if ok:
            tt["verified"] = True
        else:
            tt["wrong"] = tt.get("wrong", 0) + 1
        save_db()
        return {"ok": ok, "wrong": tt.get("wrong", 0)}
    if task["type"] == "wordle":
        secret = norm_word(task["cfg"].get("answer", "КВЕСТ")) or "КВЕСТ"
        guess = norm_word(answer)
        guesses = tt.setdefault("guesses", [])
        mx = wordle_attempts(len(secret))
        if len(guesses) >= mx or tt.get("verified"):
            raise ApiError("Попытки закончились")
        if len(guess) != len(secret):
            raise ApiError(f"Нужно слово из {len(secret)} букв")
        marks = wordle_marks(guess, secret)
        guesses.append({"w": guess, "m": marks})
        ok = guess == secret
        if ok:
            tt["verified"] = True
        save_db()
        return {"ok": ok, "word": guess, "marks": marks, "attempts": len(guesses), "max": mx,
                "over": (not ok) and len(guesses) >= mx}
    raise ApiError("Для этого задания проверка не нужна")


@handler("complete")
def h_complete(user, b):
    room = get_room(b)
    team = get_team(room, user)
    check_open(room)
    task = get_task(room, b)
    tt = team["tasks"].get(task["id"])
    if not tt or not tt.get("found"):
        raise ApiError("Сначала найдите код этого задания")
    if tt.get("solved"):
        raise ApiError("Задание уже выполнено")
    ttype = task["type"]
    mx = TASK_MAX[ttype]
    if ttype == "riddle":
        if not tt.get("verified"):
            raise ApiError("Ответ не подтверждён")
        raw = max(10, mx - 5 * tt.get("wrong", 0))
    elif ttype == "wordle":
        n = len(tt.get("guesses", []))
        secret = norm_word(task["cfg"].get("answer", "КВЕСТ")) or "КВЕСТ"
        if tt.get("verified"):
            raw = max(20, mx - 5 * (n - 1))
        elif n >= wordle_attempts(len(secret)):
            raw = 0
        else:
            raise ApiError("Ещё остались попытки")
    else:
        try:
            raw = max(0, min(mx, int(b.get("score", 0))))
        except (TypeError, ValueError):
            raw = 0
    pen = hint_penalty(ttype) if (tt.get("hint") and raw > 0) else 0
    final = max(0, raw - pen)
    tt.update(solved=True, score=final, raw=raw, penalty=pen, done_at=now_ms())
    save_db()
    return {"score": final, "raw": raw, "penalty": pen}


# ───────────── Методы админа ─────────────
def need_admin(user):
    if not is_admin(user):
        raise ApiError("Только для администратора")


@handler("admin_room")
def h_admin_room(user, b):
    need_admin(user)
    room = get_room(b)
    teams = []
    for tm in room["teams"].values():
        teams.append({"name": tm["name"], "members": list(tm["members"].values()), "score": team_total(tm),
                      "tasks": {tid: {"found": bool(x.get("found")), "solved": bool(x.get("solved")),
                                      "score": x.get("score", 0), "hint": bool(x.get("hint"))}
                                for tid, x in tm["tasks"].items()}})
    teams.sort(key=lambda x: -x["score"])
    out = {k: room[k] for k in ("id", "name", "password", "start", "end", "map", "tasks")}
    out["teams"] = teams
    return out


def clean_cfg(cfg):
    out = {}
    if isinstance(cfg, dict):
        for k, v in list(cfg.items())[:20]:
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out[str(k)[:30]] = v
            elif isinstance(v, str):
                out[str(k)[:30]] = v[:600]
    return out


@handler("admin_save")
def h_admin_save(user, b):
    need_admin(user)
    d = b.get("room") or {}
    name = str(d.get("name", "")).strip()[:60] or "Квест"
    pw = str(d.get("password", "")).strip().upper()
    if not 3 <= len(pw) <= 20 or " " in pw:
        raise ApiError("Пароль: от 3 до 20 символов, без пробелов")
    try:
        start, end = int(d.get("start")), int(d.get("end"))
    except (TypeError, ValueError):
        raise ApiError("Укажите даты начала и конца")
    if end <= start:
        raise ApiError("Конец должен быть позже начала")
    room_id = str(d.get("id") or "")
    existing = DB["rooms"].get(room_id) if room_id else None
    for r in DB["rooms"].values():
        if r["password"] == pw and (not existing or r["id"] != existing["id"]):
            raise ApiError("Такой пароль уже используется")
    raw_tasks = d.get("tasks") or []
    if not raw_tasks or len(raw_tasks) > 30:
        raise ApiError("Добавьте от 1 до 30 заданий")
    tasks, used_codes, used_ids = [], set(), set()
    for rt in raw_tasks:
        ttype = rt.get("type")
        if ttype not in TASK_MAX:
            raise ApiError("Неизвестный тип задания")
        code = "".join(ch for ch in str(rt.get("code", "")) if ch.isdigit())
        if len(code) != 6:
            code = ""
        while not code or code in used_codes:
            code = f"{secrets.randbelow(900000) + 100000}"
        used_codes.add(code)
        tid = str(rt.get("id") or "")
        if not tid or tid in used_ids:
            tid = "t" + secrets.token_hex(3)
        used_ids.add(tid)

        def coord(v):
            try:
                return min(1.0, max(0.0, float(v)))
            except (TypeError, ValueError):
                return None
        tasks.append({"id": tid, "type": ttype, "code": code, "title": str(rt.get("title", ""))[:40],
                      "hint": str(rt.get("hint", ""))[:600], "x": coord(rt.get("x")), "y": coord(rt.get("y")),
                      "cfg": clean_cfg(rt.get("cfg"))})
    map_img = d.get("map", "")
    if not (isinstance(map_img, str) and map_img.startswith("data:image/") and len(map_img) < 1_500_000):
        map_img = ""
    if existing:
        room = existing
        room.update(name=name, password=pw, start=start, end=end, map=map_img, tasks=tasks)
        for tm in room["teams"].values():  # чистим прогресс удалённых заданий
            tm["tasks"] = {k: v for k, v in tm["tasks"].items() if k in used_ids}
    else:
        room = {"id": secrets.token_hex(4), "name": name, "password": pw, "start": start, "end": end,
                "map": map_img, "tasks": tasks, "teams": {}, "members": {}}
        DB["rooms"][room["id"]] = room
    save_db()
    return {"roomId": room["id"]}


@handler("admin_delete")
def h_admin_delete(user, b):
    need_admin(user)
    room = get_room(b)
    DB["rooms"].pop(room["id"], None)
    save_db()
    return {"ok": True}


# ───────────── Веб-сервер ─────────────
def json_err(msg, status=400):
    return web.json_response({"error": msg}, status=status)


async def api_entry(request):
    fn = HANDLERS.get(request.match_info["action"])
    if not fn:
        return json_err("Неизвестный метод", 404)
    try:
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError
    except Exception:
        return json_err("Плохой запрос")
    user = check_init_data(str(body.get("initData", "")))
    if not user:
        return json_err("Откройте приложение через Telegram", 401)
    try:
        return web.json_response(fn(user, body))
    except ApiError as e:
        return json_err(str(e))
    except Exception:
        log.exception("Ошибка в методе %s", request.match_info["action"])
        return json_err("Ошибка сервера", 500)


# Раздаём ТОЛЬКО эти файлы. Раньше можно было открыть /main.py и украсть токен бота.
STATIC_OK = re.compile(r"^(app\.js|snow\.js|style\.css|quests/[a-z0-9_]+\.js)$")


async def handle_index(request):
    resp = web.FileResponse(BASE / "index.html")
    resp.headers["Cache-Control"] = "no-cache"
    return resp


async def serve_static(request):
    name = request.match_info["filename"]
    if not STATIC_OK.match(name):
        return web.Response(status=404, text="Not found")
    path = BASE / name
    if not path.is_file():
        return web.Response(status=404, text="Not found")
    resp = web.FileResponse(path)
    resp.headers["Cache-Control"] = "no-cache"
    return resp


async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    kb = [[InlineKeyboardButton("🎄 Открыть квесты", web_app=WebAppInfo(url=WEBAPP_URL))]]
    await update.message.reply_text("С наступающим! ❄️ Нажми кнопку, чтобы начать:", reply_markup=InlineKeyboardMarkup(kb))


def make_web_app():
    app = web.Application(client_max_size=3 * 1024 * 1024)
    app.router.add_post("/api/{action}", api_entry)
    app.router.add_get("/", handle_index)
    app.router.add_get("/{filename:.*}", serve_static)
    return app


async def main():
    if not BOT_TOKEN and not DEV:
        sys.exit("Не задан BOT_TOKEN. Добавь переменную окружения BOT_TOKEN в настройках хостинга.")
    load_db()
    runner = web.AppRunner(make_web_app())
    await runner.setup()
    port = int(os.environ.get("PORT", 8000))
    await web.TCPSite(runner, "0.0.0.0", port).start()
    if BOT_TOKEN:
        bot = Application.builder().token(BOT_TOKEN).build()
        bot.add_handler(CommandHandler("start", start))
        await bot.initialize()
        await bot.start()
        await bot.updater.start_polling()
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
