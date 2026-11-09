import { QUESTIONS } from './quizdata.js?v=13';

const LEVELS = { easy: ['e'], medium: ['m'], hard: ['h'], mixed: ['e', 'm', 'h'] };
// Итог викторины по 1000 очков переводится в долю баллов задания
const BANDS = [[900, 1], [750, 0.8], [600, 0.6], [450, 0.4], [300, 0.25], [1, 0.1]];
const bandOf = (total) => (BANDS.find(([min]) => total >= min) || [0, 0])[1];

let timer, alive = false, saveNow = () => {}, inQuestion = false;

const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(v) : d; };

export default {
    title: '🧠 Новогодняя викторина',
    description: 'Отвечай быстро: чем быстрее, тем больше очков',
    defaultPoints: 40,
    defaultHint: 'Не жди до последней секунды: быстрый ответ даёт больше очков. Если не уверен, убери два лишних варианта кнопкой 50/50.',
    QUESTION_COUNT: QUESTIONS.length,   // для проверки
    leaveWarning: () => (inQuestion ? 'Если выйти сейчас, текущий вопрос засчитается неверным. Выйти?' : ''),
    adminFields: [
        { key: 'difficulty', label: 'Сложность вопросов', type: 'select', def: 'mixed',
          options: [['easy', 'Лёгкие'], ['medium', 'Средние'], ['hard', 'Сложные'], ['mixed', 'Все вперемешку']] },
        { key: 'quizCount', label: 'Сколько вопросов задавать (3–30)', type: 'number', def: 10, min: 3, max: 30 },
        { key: 'quizTime', label: 'Секунд на один вопрос (5–120)', type: 'number', def: 20, min: 5, max: 120,
          note: () => 'Игрок набирает до 1000 очков: 900+ даёт все баллы задания, 750+ — 80%, 600+ — 60%, 450+ — 40%, 300+ — 25%, меньше — 10%.' },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(timer); alive = true;
        const limit = Math.min(120, Math.max(5, num(cfg.quizTime, 20))) * 1000;
        const prog = cfg.progress || {};

        // Вопросы выбираются случайно ОДИН раз для команды и сохраняются
        const pool = QUESTIONS.filter((q) => (LEVELS[cfg.difficulty] || LEVELS.mixed).includes(q[5]));
        const count = Math.min(pool.length, Math.min(30, Math.max(3, num(cfg.quizCount, 10))));
        // Новый набор: сначала берём вопросы, которых ещё не было, потом добираем остальные
        const pickQuestions = (avoid = []) => {
            const fresh = shuffle(pool.filter((q) => !avoid.includes(q[0])));
            const rest = shuffle(pool.filter((q) => avoid.includes(q[0])));
            return [...fresh, ...rest].slice(0, count).map(([q, right, a, b, c]) => ({ q, answer: right, options: shuffle([right, a, b, c]) }));
        };
        let questions = prog.questions || pickQuestions();
        const total = questions.length, base = 1000 / total;
        const pts = prog.pts || [];
        let idx = prog.idx || 0, pending = prog.pending ?? -1, notice = false;
        // Если игрок вышел, пока вопрос был открыт, вопрос засчитывается неверным (чтобы не гуглить)
        if (pending === idx && idx < total) { pts[idx] = 0; idx++; pending = -1; notice = true; }
        saveNow = () => alive && cfg.saveProgress?.({ questions, idx, pts, pending });
        saveNow();
        const timerEl = document.getElementById('quest-timer');
        const sum = () => pts.reduce((s, v) => s + (v || 0), 0);

        const finish = () => {
            clearInterval(timer);
            const score = sum(), ratio = bandOf(score);
            timerEl.innerText = '';
            inQuestion = false;
            container.innerHTML = `
                <div class="card center"><div class="muted">Твой результат</div>
                    <div class="big-score">${score} / 1000</div>
                    <div>${ratio === 1 ? 'Отлично! Все баллы за задание твои.' : ratio > 0 ? `Ты получаешь ${Math.round(ratio * 100)}% баллов за задание.` : 'В этот раз без баллов.'}</div></div>
                <button class="btn" id="quiz-done">Забрать баллы</button>
                <button class="btn btn-ghost" id="quiz-retry">Попробовать заново</button>`;
            container.querySelector('#quiz-done').onclick = () => { alive = false; onComplete(ratio); };
            // Заново: текущие очки сгорают, вопросы берутся другие и перемешиваются
            container.querySelector('#quiz-retry').onclick = () => {
                questions = pickQuestions(questions.map((x) => x.q));
                pts.length = 0; idx = 0; pending = -1; saveNow();
                show();
            };
        };

        const show = () => {
            if (!alive) return;
            if (idx >= total) return finish();
            const cur = questions[idx];
            pending = idx; inQuestion = true; saveNow();
            container.innerHTML = `
                <div class="qbar"><i id="qbar"></i></div>
                <p class="note">Вопрос ${idx + 1} из ${total} · счёт: <b>${sum()}</b> из 1000</p>
                <div class="title small center">${cur.q}</div>
                <div id="quiz-opts" class="stack"></div>
                <div class="q-points" id="q-points"></div>
                <button class="btn btn-ghost" id="btn-5050">✂️ 50/50 (считается подсказкой)</button>`;
            const box = container.querySelector('#quiz-opts');
            const bar = container.querySelector('#qbar');
            const pointsEl = container.querySelector('#q-points');
            const start = Date.now();
            let answered = false;

            const reveal = (chosen, earned) => {
                answered = true; inQuestion = false; clearInterval(timer);
                [...box.children].forEach((el) => {
                    if (el.innerText === cur.answer) el.classList.add('correct');
                    else if (el.innerText === chosen) el.classList.add('wrong');
                });
                box.style.pointerEvents = 'none';
                pts[idx] = earned; idx++; pending = -1; saveNow();
                pointsEl.innerText = earned ? `+${earned}` : (chosen ? 'Неверно: 0 очков' : 'Время вышло: 0 очков');
                setTimeout(() => alive && show(), 1300);
            };

            cur.options.forEach((text) => {
                const el = document.createElement('div');
                el.className = 'quiz-option'; el.innerText = text;
                el.onclick = () => {
                    if (answered) return;
                    if (text === cur.answer) {
                        // до 25% времени — полные очки, дальше плавно до половины
                        const r = (Date.now() - start) / limit;
                        const factor = r <= 0.25 ? 1 : Math.max(0.5, 1 - ((r - 0.25) / 0.75) * 0.5);
                        tg.HapticFeedback.notificationOccurred('success');
                        reveal(text, Math.round(base * factor));
                    } else { tg.HapticFeedback.notificationOccurred('error'); reveal(text, 0); }
                };
                box.appendChild(el);
            });

            const b5050 = container.querySelector('#btn-5050');
            b5050.onclick = async () => {
                const ok = await cfg.useHint?.();
                if (!ok || !alive || answered) return;
                shuffle(cur.options.filter((t) => t !== cur.answer)).slice(0, 2).forEach((t) => {
                    [...box.children].forEach((el) => { if (el.innerText === t) el.classList.add('off'); });
                });
                b5050.disabled = true;
            };

            timer = setInterval(() => {
                const left = Math.max(0, limit - (Date.now() - start));
                bar.style.transform = `scaleX(${left / limit})`;
                timerEl.innerText = `⏱ ${Math.ceil(left / 1000)}`;
                if (left <= 0 && !answered) { tg.HapticFeedback.notificationOccurred('error'); reveal('', 0); }
            }, 100);
        };

        if (notice) tg.showAlert('Ты выходил из задания, пока вопрос был открыт. Он засчитан неверным.', show);
        else show();
    },

    destroy() { if (alive) saveNow(); alive = false; inQuestion = false; clearInterval(timer); },
};
