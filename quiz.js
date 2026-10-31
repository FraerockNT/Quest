// Первый вариант — правильный; перед показом варианты перемешиваются
const POOL = [
    { q: 'С какого года в России Новый год отмечают 1 января?', o: ['1700', '1812', '1918', '1935'], hint: 'Это указ Петра I.' },
    { q: 'Как зовут внучку Деда Мороза?', o: ['Снегурочка', 'Метелица', 'Зимушка', 'Морозка'], hint: 'Героиня сказки Островского.' },
    { q: 'В какой стране, по традиции, живёт финский Йоулупукки?', o: ['Финляндия', 'Норвегия', 'Швеция', 'Канада'], hint: 'Страна тысячи озёр.' },
    { q: 'Какой балет Чайковского принято смотреть под Новый год?', o: ['Щелкунчик', 'Лебединое озеро', 'Спящая красавица', 'Жизель'], hint: 'Главный герой — игрушка для колки орехов.' },
    { q: 'Сколько ударов делают куранты в новогоднюю полночь?', o: ['12', '10', '24', '7'], hint: 'Столько же, сколько месяцев в году.' },
    { q: 'В какой стране под бой курантов едят 12 виноградин?', o: ['Испания', 'Италия', 'Франция', 'Португалия'], hint: 'Страна фламенко.' },
    { q: 'Кто снял фильм «Ирония судьбы, или С лёгким паром!»?', o: ['Эльдар Рязанов', 'Леонид Гайдай', 'Георгий Данелия', 'Никита Михалков'], hint: 'Он же снял «Карнавальную ночь».' },
    { q: 'Какой православный праздник отмечают 7 января?', o: ['Рождество', 'Пасха', 'Масленица', 'Троица'], hint: 'Праздник идёт сразу после Нового года.' },
    { q: 'Кто написал сказку «Снежная королева»?', o: ['Ганс Христиан Андерсен', 'Братья Гримм', 'Шарль Перро', 'Астрид Линдгрен'], hint: 'Датский сказочник.' },
    { q: 'Из какой страны к нам пришла традиция наряжать ёлку?', o: ['Германия', 'Франция', 'Англия', 'Китай'], hint: 'Страна, где изобрели «рождественские ярмарки».' },
];
const COUNT = 5;

let dead = false, timeouts = [];

const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let current = null;

export default {
    title: '🧠 Новогодняя эрудиция',
    description: 'Ответь на вопросы',
    maxScore: 20,
    defaultHint: 'Подумай, с каким праздником и страной связан вопрос.',
    getHint: () => (current ? current.hint : ''),   // подсказка меняется вместе с вопросом

    init(container, tg, onComplete, cfg = {}) {
        dead = false; timeouts = [];
        const questions = shuffle(POOL).slice(0, COUNT).map((p) => ({
            q: p.q, hint: p.hint, answer: p.o[0], options: shuffle(p.o),
        }));
        let index = 0, mistakes = 0;

        const show = () => {
            if (dead) return;
            current = questions[index];
            container.innerHTML = `
                <p class="note">Вопрос ${index + 1} из ${COUNT}${mistakes ? ` · ошибок: ${mistakes}` : ''}</p>
                <div class="title small center">${current.q}</div>
                <div id="quiz-opts" class="stack"></div>
                <button class="btn btn-ghost" id="btn-5050">✂️ Убрать два лишних (считается подсказкой)</button>`;
            const box = container.querySelector('#quiz-opts');
            current.options.forEach((text) => {
                const el = document.createElement('div');
                el.className = 'quiz-option'; el.innerText = text;
                el.onclick = () => {
                    if (el.classList.contains('correct')) return;
                    if (text === current.answer) {
                        el.classList.add('correct');
                        tg.HapticFeedback.notificationOccurred('success');
                        box.style.pointerEvents = 'none';
                        timeouts.push(setTimeout(() => {
                            index++;
                            if (index < COUNT) show(); else onComplete(Math.max(5, 20 - 3 * mistakes));
                        }, 700));
                    } else {
                        mistakes++;
                        el.classList.add('wrong'); el.style.pointerEvents = 'none';
                        tg.HapticFeedback.notificationOccurred('error');
                    }
                };
                box.appendChild(el);
            });
            container.querySelector('#btn-5050').onclick = async (e) => {
                const ok = await cfg.useHint?.();      // 50/50 тоже идёт как подсказка: спишутся баллы один раз
                if (!ok || dead) return;
                let removed = 0;
                [...box.children].sort(() => Math.random() - 0.5).forEach((el) => {
                    if (el.innerText !== current.answer && removed < 2 && !el.classList.contains('wrong')) { el.classList.add('off'); removed++; }
                });
                e.target.disabled = true;
            };
        };
        show();
    },

    destroy() { dead = true; timeouts.forEach(clearTimeout); current = null; },
};
