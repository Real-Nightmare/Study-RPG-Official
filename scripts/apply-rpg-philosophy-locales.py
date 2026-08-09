"""
Apply the Study RPG philosophy reframe to all 15 locale files.

The locale JSON files exceed the file tools' size limit, so this script performs
the edits at the JSON level (the same pattern as scripts/add-phase6-frontend.py).
It is idempotent: run it as many times as you like. Every file is validated as
JSON before and after, and non-ASCII text is preserved as literal UTF-8.

Usage:  python3 scripts/apply-rpg-philosophy-locales.py
"""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'locales')
LANGS = ['ar', 'bn', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'nl', 'pt-BR', 'ru', 'uk', 'zh']

# ---------------------------------------------------------------- philosophy ---
PHILOSOPHY = {
    'en': {
        'badge': 'The Study RPG Way',
        'title': 'Mastery Over',
        'titleHighlight': 'Memorisation',
        'description': 'Study RPG is not a simple studying tool — it encourages proper and deep learning. Daily study through active recall, rewards that make studying feel like playtime, and AI tutors for quizzes, revision tests, practice exams, teach-back and collaborative exams — so you master topics, not just memorise them.',
        'learnMore': 'Learn more',
        'goalTitle': 'The Goal',
        'goal': 'Learn through mastery and true understanding of topics — not simple memorisation. Jobs demand mastery of study, and rote memorisation cannot beat the skill of real learning.',
        'healthTitle': 'Study Health',
        'health': 'We prioritise student health with a proper timetable. Miss study time and it reschedules efficient catch-up — while events promote unity and fresh ideas.',
        'freeToWin': '100% Free to Win — no shortcuts, no pay-to-win',
        'start': 'Start Your Journey',
        'pillars': {
            'missions': {'title': 'Missions', 'description': 'Any task — homework, assignments, projects — is a mission with low-level rewards that build the rote memorisation memory skills require.'},
            'revisionCentre': {'title': 'Revision Centre', 'description': 'Depth over Length. Sign up, revise properly, then prove it — apply an idea in a different scenario to earn medium-level rewards.'},
            'competencyTesting': {'title': 'Competency-Based Testing', 'description': 'Choose a subject and face competency questions that enhance thinking skills — with insights into why marks were lost and how to improve.'},
            'programmes': {'title': 'Programmes', 'description': 'Optional frameworks that train you to think and create systems that solve real study problems. Your choice matters most.'},
            'factions': {'title': 'Factions', 'description': 'Study groups with one team leader who leads the Faction to better study and higher scores. Weaker factions receive help from stronger ones — studying by helping each other.'},
        },
    },
    'ar': {
        'badge': 'طريقة Study RPG',
        'title': 'الإتقان قبل',
        'titleHighlight': 'الحفظ',
        'description': 'Study RPG ليست أداة دراسة بسيطة — إنها تشجّع التعلّم العميق الحقيقي. دراسة يومية عبر الاسترجاع النشط، ومكافآت تجعل الدراسة تشبه وقت اللعب، ومدرّسون بالذكاء الاصطناعي للاختبارات واختبارات المراجعة والامتحانات التدريبية والتعلّم بالتدريس والامتحانات التعاونية — لِتُتقن المواضيع لا أن تحفظها فحسب.',
        'learnMore': 'اعرف المزيد',
        'goalTitle': 'الهدف',
        'goal': 'التعلّم عبر الإتقان والفهم الحقيقي للمواضيع — لا الحفظ البسيط. الوظائف تتطلب إتقان الدراسة، والحفظ لا يهزم مهارة التعلّم الحقيقي.',
        'healthTitle': 'صحة الدراسة',
        'health': 'نُولي صحة الطالب أولوية بجدول زمني مناسب. فوات وقت الدراسة يُعاد جدولته بكفاءة — بينما تعزّز الأحداث الوحدة والأفكار الجديدة.',
        'freeToWin': 'فوز مجاني 100% — بلا اختصارات ولا دفع للفوز',
        'start': 'ابدأ رحلتك',
        'pillars': {
            'missions': {'title': 'المهام', 'description': 'أي مهمة — واجب، تكليف، مشروع — هي مهمة بمكافآت منخفضة تُبني الحفظ الآلي الذي تتطلبه مهارات الذاكرة.'},
            'revisionCentre': {'title': 'مركز المراجعة', 'description': 'العمق قبل الطول. سجّل، راجع جيدًا، ثم أثبت ذلك — طبّق فكرة في سيناريو مختلف لتحصل على مكافآت متوسطة.'},
            'competencyTesting': {'title': 'الاختبارات القائمة على الكفاءة', 'description': 'اختر مادة وواجه أسئلة كفاءة تعزّز مهارات التفكير — مع رؤى حول سبب خسارة الدرجات وكيفية التحسّن.'},
            'programmes': {'title': 'البرامج', 'description': 'أطر اختيارية تدرّبك على التفكير وابتكار أنظمة تحل مشكلات الدراسة الحقيقية. اختيارك هو الأهم.'},
            'factions': {'title': 'الفصائل', 'description': 'مجموعات دراسة يقودها قائد واحد يقود الفصيل نحو دراسة أفضل ونتائج أعلى. الفصائل الأضعف تتلقى المساعدة من الأقوى — الدراسة بالتعاون المتبادل.'},
        },
    },
    'bn': {
        'badge': 'Study RPG-র পথ',
        'title': 'মুখস্থের উপরে',
        'titleHighlight': 'দক্ষতা',
        'description': 'Study RPG কোনো সাধারণ পড়ার টুল নয় — এটি সঠিক ও গভীর শেখাকে উৎসাহিত করে। অ্যাক্টিভ রিকলের মাধ্যমে দৈনিক পড়া, এমন পুরস্কার যা পড়াকে খেলার সময়ের মতো অনুভব করায়, আর কুইজ, রিভিশন টেস্ট, প্র্যাকটিস পরীক্ষা, টিচ-ব্যাক ও সমবায় পরীক্ষার জন্য AI টিউটর — যাতে আপনি বিষয়গুলো আয়ত্ত করেন, শুধু মুখস্থ নয়।',
        'learnMore': 'আরও জানুন',
        'goalTitle': 'লক্ষ্য',
        'goal': 'সাধারণ মুখস্থ নয় — বিষয়ের দক্ষতা ও সত্যিকারের বোঝাপড়ার মাধ্যমে শেখা। চাকরি পড়াশোনার দক্ষতা চায়, আর মুখস্থ সত্যিকারের শেখার দক্ষতাকে হারাতে পারে না।',
        'healthTitle': 'পড়াশোনার স্বাস্থ্য',
        'health': 'সঠিক সময়সূচি দিয়ে আমরা শিক্ষার্থীর স্বাস্থ্যকে অগ্রাধিকার দিই। মিস করা পড়ার সময় কার্যকরভাবে পুনর্নির্ধারিত হয় — আর ইভেন্ট ঐক্য ও নতুন ধারণা বাড়ায়।',
        'freeToWin': '১০০% ফ্রি-টু-উইন — কোনো শর্টকাট নেই, পে-টু-উইন নেই',
        'start': 'আপনার যাত্রা শুরু করুন',
        'pillars': {
            'missions': {'title': 'মিশন', 'description': 'যেকোনো কাজ — হোমওয়ার্ক, অ্যাসাইনমেন্ট, প্রজেক্ট — কম পুরস্কারের মিশন, যা স্মৃতির দক্ষতার জন্য প্রয়োজনীয় মুখস্থ দক্ষতা গড়ে তোলে।'},
            'revisionCentre': {'title': 'রিভিশন সেন্টার', 'description': 'দৈর্ঘ্যের উপরে গভীরতা। সাইন আপ করুন, ভালোভাবে রিভিশন করুন, তারপর প্রমাণ করুন — শেখা ধারণা ভিন্ন পরিস্থিতিতে প্রয়োগ করে মাঝারি পুরস্কার পান।'},
            'competencyTesting': {'title': 'দক্ষতা-ভিত্তিক পরীক্ষণ', 'description': 'একটি বিষয় বেছে নিন এবং দক্ষতা-ভিত্তিক প্রশ্নের মুখোমুখি হোন যা চিন্তার দক্ষতা বাড়ায় — কেন নম্বর কাটা গেল ও কীভাবে উন্নতি করবেন তার অন্তর্দৃষ্টিসহ।'},
            'programmes': {'title': 'প্রোগ্রাম', 'description': 'ঐচ্ছিক কাঠামো যা আপনাকে চিন্তা করতে ও বাস্তব পড়ার সমস্যা সমাধানের সিস্টেম তৈরি করতে শেখায়। আপনার পছন্দই সবচেয়ে গুরুত্বপূর্ণ।'},
            'factions': {'title': 'গোষ্ঠী', 'description': 'একজন টিম লিডারের নেতৃত্বে পড়ার দল, যে গোষ্ঠীকে ভালো পড়া ও উচ্চ স্কোরের দিকে নিয়ে যায়। দুর্বল গোষ্ঠী শক্তিশালীদের কাছ থেকে সাহায্য পায় — পরস্পরকে সাহায্য করে পড়া।'},
        },
    },
    'de': {
        'badge': 'Der Study-RPG-Weg',
        'title': 'Meisterschaft statt',
        'titleHighlight': 'Auswendiglernen',
        'description': 'Study RPG ist kein einfaches Lerntool — es fördert richtiges, tiefes Lernen. Tägliches Lernen durch aktives Abrufen, Belohnungen, die Lernen wie Spielzeit wirken lassen, und KI-Tutoren für Quizze, Wiederholungstests, Übungsprüfungen, Teach-back und kooperative Prüfungen — damit du Themen beherrschst, statt sie nur auswendig zu lernen.',
        'learnMore': 'Mehr erfahren',
        'goalTitle': 'Das Ziel',
        'goal': 'Lernen durch Meisterschaft und echtes Verständnis von Themen — nicht durch simples Auswendiglernen. Jobs verlangen Meisterschaft im Lernen, und Auswendiglernen schlägt die Fähigkeit des echten Lernens nicht.',
        'healthTitle': 'Lerngesundheit',
        'health': 'Wir stellen die Gesundheit der Lernenden mit einem guten Zeitplan an erste Stelle. Verpasste Lernzeit wird effizient nachgeholt — während Events Einheit und neue Ideen fördern.',
        'freeToWin': '100 % frei zu gewinnen — keine Abkürzungen, kein Pay-to-Win',
        'start': 'Starte deine Reise',
        'pillars': {
            'missions': {'title': 'Missionen', 'description': 'Jede Aufgabe — Hausaufgaben, Projekte — ist eine Mission mit niedrigen Belohnungen, die das Auswendiglernen aufbaut, das Gedächtnisleistungen brauchen.'},
            'revisionCentre': {'title': 'Revisionszentrum', 'description': 'Tiefe vor Länge. Melde dich an, wiederhole gründlich und beweise es — wende eine Idee in einem anderen Szenario an, um mittlere Belohnungen zu erhalten.'},
            'competencyTesting': {'title': 'Kompetenzbasierte Tests', 'description': 'Wähle ein Fach und stelle dich Kompetenzfragen, die Denkfähigkeiten fördern — mit Einblicken, warum Punkte verloren gingen und wie du dich verbesserst.'},
            'programmes': {'title': 'Programme', 'description': 'Optionale Rahmenwerke, die dich trainieren, Systeme zu denken und zu entwickeln, die echte Lernprobleme lösen. Deine Wahl zählt am meisten.'},
            'factions': {'title': 'Fraktionen', 'description': 'Lerngruppen mit einem Teamleiter, der die Fraktion zu besserem Lernen und höheren Ergebnissen führt. Schwächere Fraktionen erhalten Hilfe von stärkeren — Lernen durch gegenseitige Hilfe.'},
        },
    },
    'es': {
        'badge': 'El camino de Study RPG',
        'title': 'Dominio sobre',
        'titleHighlight': 'la memorización',
        'description': 'Study RPG no es una simple herramienta de estudio: fomenta un aprendizaje profundo y real. Estudio diario mediante recuerdo activo, recompensas que hacen que estudiar se sienta como tiempo de juego, y tutores de IA para cuestionarios, pruebas de repaso, exámenes de práctica, teach-back y exámenes colaborativos — para que domines los temas, no solo los memorices.',
        'learnMore': 'Saber más',
        'goalTitle': 'La meta',
        'goal': 'Aprender mediante el dominio y la comprensión real de los temas, no mediante la simple memorización. Los trabajos exigen dominio del estudio, y la memorización no vence la habilidad del aprendizaje real.',
        'healthTitle': 'Salud de estudio',
        'health': 'Priorizamos la salud del estudiante con un horario adecuado. El tiempo de estudio perdido se reprograma de forma eficiente — mientras los eventos fomentan la unidad y las ideas nuevas.',
        'freeToWin': '100 % gratis para ganar — sin atajos ni pay-to-win',
        'start': 'Comienza tu viaje',
        'pillars': {
            'missions': {'title': 'Misiones', 'description': 'Cualquier tarea — deberes, trabajos, proyectos — es una misión con recompensas bajas que construyen la memorización que exigen las habilidades de memoria.'},
            'revisionCentre': {'title': 'Centro de repaso', 'description': 'Profundidad antes que longitud. Apúntate, repasa bien y demuéstralo: aplica una idea en un escenario distinto para ganar recompensas medias.'},
            'competencyTesting': {'title': 'Evaluación por competencias', 'description': 'Elige una asignatura y enfréntate a preguntas de competencia que mejoran el pensamiento — con información sobre por qué se perdieron puntos y cómo mejorar.'},
            'programmes': {'title': 'Programas', 'description': 'Marcos opcionales que te entrenan para pensar y crear sistemas que resuelven problemas reales de estudio. Tu elección es lo que más importa.'},
            'factions': {'title': 'Facciones', 'description': 'Grupos de estudio con un líder de equipo que guía a la facción hacia un mejor estudio y mejores puntuaciones. Las facciones más débiles reciben ayuda de las más fuertes: estudiar ayudándose mutuamente.'},
        },
    },
    'fr': {
        'badge': 'La voie de Study RPG',
        'title': 'La maîtrise plutôt que',
        'titleHighlight': 'la mémorisation',
        'description': 'Study RPG n\u2019est pas un simple outil d\u2019étude — il encourage un apprentissage profond et véritable. Étude quotidienne par rappel actif, récompenses qui rendent l\u2019étude aussi agréable que le jeu, et tuteurs IA pour quiz, tests de révision, examens blancs, teach-back et examens collaboratifs — pour maîtriser les sujets, pas seulement les mémoriser.',
        'learnMore': 'En savoir plus',
        'goalTitle': 'L\u2019objectif',
        'goal': 'Apprendre par la maîtrise et la compréhension réelle des sujets — pas par simple mémorisation. Les métiers exigent la maîtrise de l\u2019étude, et la mémorisation ne bat pas la compétence du véritable apprentissage.',
        'healthTitle': 'Santé d\u2019étude',
        'health': 'Nous priorisons la santé de l\u2019étudiant avec un emploi du temps adapté. Le temps d\u2019étude manqué est reprogrammé efficacement — tandis que les événements favorisent l\u2019unité et les idées nouvelles.',
        'freeToWin': '100 % gratuit pour gagner — ni raccourcis ni pay-to-win',
        'start': 'Commencez votre aventure',
        'pillars': {
            'missions': {'title': 'Missions', 'description': 'Toute tâche — devoirs, projets — est une mission aux récompenses modestes qui construit la mémorisation nécessaire aux compétences de mémoire.'},
            'revisionCentre': {'title': 'Centre de révision', 'description': 'La profondeur plutôt que la longueur. Inscrivez-vous, révisez sérieusement, puis prouvez-le : appliquez une idée dans un scénario différent pour gagner des récompenses moyennes.'},
            'competencyTesting': {'title': 'Évaluation par compétences', 'description': 'Choisissez une matière et affrontez des questions de compétence qui renforcent la pensée — avec des explications sur les points perdus et comment progresser.'},
            'programmes': {'title': 'Programmes', 'description': 'Des cadres facultatifs qui vous entraînent à penser et à créer des systèmes qui résolvent de vrais problèmes d\u2019étude. Votre choix est ce qui compte le plus.'},
            'factions': {'title': 'Factions', 'description': 'Groupes d\u2019étude avec un chef d\u2019équipe qui mène la faction vers un meilleur apprentissage et de meilleurs scores. Les factions plus faibles reçoivent l\u2019aide des plus fortes — étudier en s\u2019entraidant.'},
        },
    },
    'hi': {
        'badge': 'Study RPG का तरीका',
        'title': 'रटने से बेहतर',
        'titleHighlight': 'निपुणता',
        'description': 'Study RPG कोई साधारण अध्ययन उपकरण नहीं है — यह सही और गहन सीखने को प्रोत्साहित करता है। सक्रिय स्मरण से दैनिक पढ़ाई, ऐसे पुरस्कार जो पढ़ाई को खेल-समय जैसा बनाते हैं, और क्विज़, रिवीज़न टेस्ट, प्रैक्टिस परीक्षा, टीच-बैक व सहयोगी परीक्षाओं के लिए AI ट्यूटर — ताकि आप विषयों में निपुण हों, न कि सिर्फ़ रटें।',
        'learnMore': 'और जानें',
        'goalTitle': 'लक्ष्य',
        'goal': 'विषयों की निपुणता और सच्ची समझ से सीखना — साधारण रटना नहीं। नौकरियों में अध्ययन की निपुणता चाहिए, और रटना सच्चे सीखने के कौशल को नहीं हरा सकता।',
        'healthTitle': 'अध्ययन स्वास्थ्य',
        'health': 'हम उचित समय-सारणी के साथ विद्यार्थी के स्वास्थ्य को प्राथमिकता देते हैं। छूटा हुआ अध्ययन समय कुशलतापूर्वक पुनर्निर्धारित होता है — जबकि इवेंट एकता और नए विचारों को बढ़ावा देते हैं।',
        'freeToWin': '100% फ्री-टु-विन — कोई शॉर्टकट नहीं, कोई पे-टु-विन नहीं',
        'start': 'अपनी यात्रा शुरू करें',
        'pillars': {
            'missions': {'title': 'मिशन', 'description': 'कोई भी कार्य — होमवर्क, असाइनमेंट, प्रोजेक्ट — कम पुरस्कार वाला मिशन है जो स्मृति कौशल के लिए ज़रूरी रटने की क्षमता बनाता है।'},
            'revisionCentre': {'title': 'रिवीज़न सेंटर', 'description': 'लंबाई से पहले गहराई। साइन अप करें, ठीक से रिवीज़न करें, फिर साबित करें — किसी विचार को अलग परिदृश्य में लागू करके मध्यम पुरस्कार पाएँ।'},
            'competencyTesting': {'title': 'योग्यता-आधारित परीक्षण', 'description': 'कोई विषय चुनें और योग्यता प्रश्नों का सामना करें जो सोचने के कौशल को बढ़ाते हैं — साथ में यह जानकारी कि अंक क्यों कटे और कैसे सुधारें।'},
            'programmes': {'title': 'प्रोग्राम', 'description': 'ऐच्छिक ढाँचे जो आपको सोचने और वास्तविक अध्ययन समस्याओं को हल करने वाली प्रणालियाँ बनाने का प्रशिक्षण देते हैं। आपकी पसंद सबसे मायने रखती है।'},
            'factions': {'title': 'गुट', 'description': 'एक टीम लीडर के नेतृत्व वाले अध्ययन समूह जो गुट को बेहतर पढ़ाई और ऊँचे स्कोर की ओर ले जाते हैं। कमज़ोर गुटों को मज़बूत गुटों से मदद मिलती है — एक-दूसरे की मदद से पढ़ाई।'},
        },
    },
    'it': {
        'badge': 'La via di Study RPG',
        'title': 'Padronanza prima della',
        'titleHighlight': 'memorizzazione',
        'description': 'Study RPG non è un semplice strumento di studio: incoraggia un apprendimento profondo e vero. Studio quotidiano con richiamo attivo, ricompense che rendono lo studio piacevole come il gioco, e tutor IA per quiz, test di ripasso, esami di pratica, teach-back ed esami collaborativi — per padroneggiare i temi, non solo memorizzarli.',
        'learnMore': 'Scopri di più',
        'goalTitle': 'L\u2019obiettivo',
        'goal': 'Imparare con la padronanza e la comprensione vera dei temi — non con la semplice memorizzazione. I lavori richiedono padronanza dello studio, e la memorizzazione non batte l\u2019abilità dell\u2019apprendimento vero.',
        'healthTitle': 'Salute di studio',
        'health': 'Diamo priorità alla salute dello studente con un programma adeguato. Il tempo di studio perso viene riprogrammato in modo efficiente — mentre gli eventi favoriscono unità e nuove idee.',
        'freeToWin': '100% gratis per vincere — niente scorciatoie, niente pay-to-win',
        'start': 'Inizia il tuo viaggio',
        'pillars': {
            'missions': {'title': 'Missioni', 'description': 'Ogni compito — compiti a casa, progetti — è una missione con ricompense basse che costruisce la memorizzazione necessaria alle abilità di memoria.'},
            'revisionCentre': {'title': 'Centro di ripasso', 'description': 'Profondità prima della lunghezza. Iscriviti, ripassa sul serio e dimostralo: applica un\u2019idea in uno scenario diverso per ottenere ricompense medie.'},
            'competencyTesting': {'title': 'Valutazione per competenze', 'description': 'Scegli una materia e affronta domande di competenza che migliorano il pensiero — con indicazioni sul perché hai perso punti e come migliorare.'},
            'programmes': {'title': 'Programmi', 'description': 'Strutture facoltative che ti addestrano a pensare e creare sistemi che risolvono veri problemi di studio. La tua scelta è ciò che conta di più.'},
            'factions': {'title': 'Fazioni', 'description': 'Gruppi di studio con un caposquadra che guida la fazione verso uno studio migliore e punteggi più alti. Le fazioni più deboli ricevono aiuto dalle più forti: studiare aiutandosi a vicenda.'},
        },
    },
    'ja': {
        'badge': 'Study RPGの流儀',
        'title': '暗記より',
        'titleHighlight': '習得',
        'description': 'Study RPGは単なる勉強ツールではありません——本当の深い学びを促します。アクティブリコールによる毎日の学習、勉強が遊び時間のように感じられる報酬、そしてクイズ・復習テスト・模擬試験・ティーチバック・共同試験のためのAIチューター——暗記するだけでなく、テーマを習得するための仕組みです。',
        'learnMore': '詳しく見る',
        'goalTitle': '目標',
        'goal': '単なる暗記ではなく、テーマの習得と真の理解によって学ぶこと。仕事は学びの習得を求めます。暗記では、本当に学ぶ力には勝てません。',
        'healthTitle': '学習の健康',
        'health': '適切な時間割で学習者の健康を最優先します。逃した学習時間は効率よく再調整され、イベントは一体感と新しいアイデアを生みます。',
        'freeToWin': '100%無料で勝てる——近道も課金勝利もありません',
        'start': '旅を始める',
        'pillars': {
            'missions': {'title': 'ミッション', 'description': '宿題・課題・プロジェクトなど、どんなタスクも低報酬のミッションです。記憶力に必要な反復暗記を育てます。'},
            'revisionCentre': {'title': '復習センター', 'description': '長さより深さ。登録してしっかり復習し、証明しましょう——学んだ考えを別の場面で応用して中程度の報酬を得ます。'},
            'competencyTesting': {'title': 'コンピテンシー評価', 'description': '科目を選び、思考力を高める能力問題に挑戦——どこで点数を失ったか、どう改善するかの洞察付きです。'},
            'programmes': {'title': 'プログラム', 'description': '実際の学習課題を解決するシステムを考え、作る力を育てる任意参加の枠組み。あなたの選択が最も大切です。'},
            'factions': {'title': 'ファクション', 'description': '1人のチームリーダーが率いる学習グループで、より良い学習と高いスコアへ導きます。弱いファクションは強いファクションから助けを受けます——助け合って学びます。'},
        },
    },
    'ko': {
        'badge': 'Study RPG의 방식',
        'title': '암기보다',
        'titleHighlight': '숙달',
        'description': 'Study RPG는 단순한 학습 도구가 아닙니다 — 진정한 깊은 학습을 장려합니다. 능동적 회상으로 매일 공부하고, 공부가 놀이 시간처럼 느껴지는 보상, 그리고 퀴즈·복습 테스트·연습 시험·티치백·공동 시험을 위한 AI 튜터 — 암기만 하는 것이 아니라 주제를 숙달하게 합니다.',
        'learnMore': '자세히 보기',
        'goalTitle': '목표',
        'goal': '단순한 암기가 아니라 주제의 숙달과 진정한 이해를 통해 배우는 것. 직업은 학습의 숙달을 요구하며, 암기는 진짜 학습의 힘을 이기지 못합니다.',
        'healthTitle': '학습 건강',
        'health': '적절한 시간표로 학생의 건강을 최우선으로 합니다. 놓친 학습 시간은 효율적으로 다시 잡히며, 이벤트는 연대와 새로운 아이디어를 키웁니다.',
        'freeToWin': '100% 무료 승리 — 지름길도 페이-투-윈도 없습니다',
        'start': '여정 시작하기',
        'pillars': {
            'missions': {'title': '미션', 'description': '숙제·과제·프로젝트 등 어떤 일이든 낮은 보상의 미션으로, 기억력에 필요한 암기력을 키웁니다.'},
            'revisionCentre': {'title': '복습 센터', 'description': '길이보다 깊이. 가입하고 제대로 복습한 뒤 증명하세요 — 배운 아이디어를 다른 상황에 적용해 중간 보상을 얻습니다.'},
            'competencyTesting': {'title': '역량 기반 평가', 'description': '과목을 고르고 사고력을 키우는 역량 문제에 도전하세요 — 어디서 점수를 잃었는지, 어떻게 개선할지에 대한 통찰과 함께.'},
            'programmes': {'title': '프로그램', 'description': '실제 학습 문제를 해결하는 시스템을 생각하고 만들도록 훈련하는 선택형 프레임워크. 당신의 선택이 가장 중요합니다.'},
            'factions': {'title': '진영', 'description': '한 명의 팀 리더가 이끄는 학습 그룹으로, 더 나은 공부와 더 높은 점수로 진영을 이끕니다. 약한 진영은 강한 진영의 도움을 받습니다 — 서로 돕는 학습.'},
        },
    },
    'nl': {
        'badge': 'De Study RPG-manier',
        'title': 'Meesterschap boven',
        'titleHighlight': 'memoriseren',
        'description': 'Study RPG is geen simpel leermiddel — het stimuleert echt en diep leren. Dagelijks studeren met actief ophalen, beloningen die studeren als speeltijd laten voelen, en AI-tutoren voor quizzen, herhalingstoetsen, oefenexamens, teach-back en samenwerkende examens — zodat je onderwerpen beheerst, niet alleen memoriseert.',
        'learnMore': 'Meer weten',
        'goalTitle': 'Het doel',
        'goal': 'Leren door meesterschap en echt begrip van onderwerpen — niet door simpel memoriseren. Banen vereisen meesterschap van studeren, en memoriseren verslaat de vaardigheid van echt leren niet.',
        'healthTitle': 'Studiegezondheid',
        'health': 'We geven prioriteit aan de gezondheid van de student met een goed rooster. Gemiste studietijd wordt efficiënt ingehaald — terwijl evenementen eenheid en nieuwe ideeën bevorderen.',
        'freeToWin': '100% gratis om te winnen — geen shortcuts, geen pay-to-win',
        'start': 'Begin je reis',
        'pillars': {
            'missions': {'title': 'Missies', 'description': 'Elke taak — huiswerk, opdrachten, projecten — is een missie met lage beloningen die het memoriseren opbouwt dat geheugenvaardigheden nodig hebben.'},
            'revisionCentre': {'title': 'Herhalingscentrum', 'description': 'Diepte boven lengte. Schrijf je in, herhaal grondig en bewijs het: pas een idee toe in een ander scenario voor gemiddelde beloningen.'},
            'competencyTesting': {'title': 'Competentiegericht toetsen', 'description': 'Kies een vak en beantwoord competentievragen die denkvaardigheden verbeteren — met inzicht in waarom punten verloren gingen en hoe je verbetert.'},
            'programmes': {'title': 'Programma\u2019s', 'description': 'Optionele kaders die je trainen om systemen te bedenken en te maken die echte studieproblemen oplossen. Jouw keuze is het belangrijkst.'},
            'factions': {'title': 'Fracties', 'description': 'Studiegroepen met één teamleider die de fractie naar beter studeren en hogere scores leidt. Zwakkere fracties krijgen hulp van sterkere — studeren door elkaar te helpen.'},
        },
    },
    'pt-BR': {
        'badge': 'O caminho do Study RPG',
        'title': 'Domínio em vez de',
        'titleHighlight': 'memorização',
        'description': 'Study RPG não é uma simples ferramenta de estudo — ele incentiva o aprendizado profundo e real. Estudo diário com recordação ativa, recompensas que fazem o estudo parecer tempo de lazer, e tutores de IA para quizzes, testes de revisão, simulados, teach-back e exames colaborativos — para você dominar os temas, não apenas memorizá-los.',
        'learnMore': 'Saiba mais',
        'goalTitle': 'A meta',
        'goal': 'Aprender com domínio e compreensão real dos temas — não com memorização simples. Empregos exigem domínio do estudo, e a memorização não vence a habilidade do aprendizado real.',
        'healthTitle': 'Saúde de estudo',
        'health': 'Priorizamos a saúde do estudante com uma rotina adequada. O tempo de estudo perdido é reprogramado com eficiência — enquanto os eventos promovem união e novas ideias.',
        'freeToWin': '100% grátis para vencer — sem atalhos, sem pay-to-win',
        'start': 'Comece sua jornada',
        'pillars': {
            'missions': {'title': 'Missões', 'description': 'Qualquer tarefa — dever de casa, trabalhos, projetos — é uma missão com recompensas baixas que constroem a memorização que as habilidades de memória exigem.'},
            'revisionCentre': {'title': 'Centro de revisão', 'description': 'Profundidade em vez de extensão. Inscreva-se, revise a sério e prove: aplique uma ideia em um cenário diferente para ganhar recompensas médias.'},
            'competencyTesting': {'title': 'Avaliação por competências', 'description': 'Escolha uma matéria e enfrente questões de competência que melhoram o pensamento — com insights sobre por que pontos foram perdidos e como melhorar.'},
            'programmes': {'title': 'Programas', 'description': 'Estruturas opcionais que treinam você a pensar e criar sistemas que resolvem problemas reais de estudo. Sua escolha é o que mais importa.'},
            'factions': {'title': 'Facções', 'description': 'Grupos de estudo com um líder que conduz a facção a um estudo melhor e pontuações mais altas. Facções mais fracas recebem ajuda das mais fortes — estudar ajudando uns aos outros.'},
        },
    },
    'ru': {
        'badge': 'Путь Study RPG',
        'title': 'Мастерство вместо',
        'titleHighlight': 'зубрёжки',
        'description': 'Study RPG — это не просто инструмент для учёбы, он поощряет настоящее глубокое обучение. Ежедневная учёба через активное припоминание, награды, которые делают учёбу похожей на игру, и ИИ-тьюторы для викторин, контрольных тестов, пробных экзаменов, teach-back и совместных экзаменов — чтобы вы овладевали темами, а не просто заучивали их.',
        'learnMore': 'Подробнее',
        'goalTitle': 'Цель',
        'goal': 'Учиться через мастерство и подлинное понимание тем — не через простое заучивание. Работа требует мастерства в учёбе, а зубрёжка не победит навык настоящего обучения.',
        'healthTitle': 'Здоровье учёбы',
        'health': 'Мы ставим здоровье ученика на первое место и обеспечиваем правильное расписание. Пропущенное время учёбы эффективно переносится — а события развивают единство и новые идеи.',
        'freeToWin': '100% честная победа — без лазеек и pay-to-win',
        'start': 'Начни свой путь',
        'pillars': {
            'missions': {'title': 'Миссии', 'description': 'Любое задание — домашняя работа, проекты — это миссия с невысокими наградами, которая развивает заучивание, нужное для памяти.'},
            'revisionCentre': {'title': 'Центр повторения', 'description': 'Глубина важнее объёма. Запишись, как следует повтори и докажи: примени идею в другом сценарии, чтобы получить средние награды.'},
            'competencyTesting': {'title': 'Тесты по компетенциям', 'description': 'Выбери предмет и решай компетентностные вопросы, развивающие мышление, — с разбором, почему потеряны баллы и как улучшиться.'},
            'programmes': {'title': 'Программы', 'description': 'Добровольные рамки, которые учат думать и создавать системы, решающие реальные проблемы учёбы. Твой выбор важнее всего.'},
            'factions': {'title': 'Фракции', 'description': 'Учебные группы с одним лидером, который ведёт фракцию к лучшей учёбе и высоким баллам. Слабые фракции получают помощь от сильных — учиться, помогая друг другу.'},
        },
    },
    'uk': {
        'badge': 'Шлях Study RPG',
        'title': 'Майстерність, а не',
        'titleHighlight': 'зазубрювання',
        'description': 'Study RPG — це не просто інструмент для навчання: він заохочує справжнє глибоке навчання. Щоденне навчання через активне пригадування, нагороди, що роблять навчання схожим на гру, та ІІ-тьютори для вікторин, перевірочних тестів, пробних іспитів, teach-back і спільних іспитів — щоб ви опановували теми, а не просто заучували їх.',
        'learnMore': 'Дізнатися більше',
        'goalTitle': 'Мета',
        'goal': 'Вчитися через майстерність і справжнє розуміння тем — не через просте заучування. Робота вимагає майстерності навчання, а зубріння не переможе навички справжнього навчання.',
        'healthTitle': 'Здоров\u2019я навчання',
        'health': 'Ми ставимо здоров\u2019я учня на перше місце з правильним розкладом. Пропущений час навчання ефективно переноситься — а події сприяють єдності та новим ідеям.',
        'freeToWin': '100% чесна перемога — без обхідних шляхів і pay-to-win',
        'start': 'Розпочни свій шлях',
        'pillars': {
            'missions': {'title': 'Місії', 'description': 'Будь-яке завдання — домашня робота, проєкти — це місія з невисокими нагородами, яка розвиває заучування, потрібне для пам\u2019яті.'},
            'revisionCentre': {'title': 'Центр повторення', 'description': 'Глибина важливіша за обсяг. Запишись, як слід повтори і доведи: застосуй ідею в іншому сценарії, щоб отримати середні нагороди.'},
            'competencyTesting': {'title': 'Тестування компетенцій', 'description': 'Обери предмет і розв\u2019язуй компетентнісні питання, що розвивають мислення, — із розбором, чому втрачено бали та як покращитись.'},
            'programmes': {'title': 'Програми', 'description': 'Добровільні рамки, які вчать думати та створювати системи, що розв\u2019язують реальні проблеми навчання. Твій вибір найважливіший.'},
            'factions': {'title': 'Фракції', 'description': 'Навчальні групи з одним лідером, який веде фракцію до кращого навчання та вищих балів. Слабкі фракції отримують допомогу від сильних — вчитися, допомагаючи одне одному.'},
        },
    },
    'zh': {
        'badge': 'Study RPG 之道',
        'title': '掌握胜过',
        'titleHighlight': '死记硬背',
        'description': 'Study RPG 不是简单的学习工具——它鼓励真正的深度学习。通过主动回忆坚持每日学习，用奖励让学习像游戏时间一样愉悦，还有 AI 导师提供测验、复习测试、模拟考试、教回授和协作考试——让你掌握主题，而不是死记硬背。',
        'learnMore': '了解更多',
        'goalTitle': '目标',
        'goal': '通过掌握和真正理解主题来学习，而不是简单死记硬背。工作需要的正是学习的掌握，而死记硬背赢不了真正学习的能力。',
        'healthTitle': '学习健康',
        'health': '我们用合理的时间表把学生的健康放在首位。错过的学习时间会被高效地重新安排——同时活动促进团结与新想法。',
        'freeToWin': '100% 免费取胜——没有捷径，没有付费取胜',
        'start': '开始你的旅程',
        'pillars': {
            'missions': {'title': '任务', 'description': '任何任务——作业、项目——都是低奖励的任务，锻炼记忆技能所需的背诵能力。'},
            'revisionCentre': {'title': '复习中心', 'description': '深度优先于长度。报名、认真复习，然后证明——在另一个场景中运用学到的想法，赢取中等奖励。'},
            'competencyTesting': {'title': '能力测评', 'description': '选择一门科目，面对提升思维能力的能力题——同时了解为什么丢分以及如何改进。'},
            'programmes': {'title': '计划', 'description': '可选的框架，训练你思考并创造解决真实学习问题的系统。你的选择最为重要。'},
            'factions': {'title': '阵营', 'description': '由一名队长带领的学习小组，带领阵营走向更好的学习和更高的分数。较弱的阵营会得到较强阵营的帮助——互相帮助，一起学习。'},
        },
    },
}

# ----------------------------------------------------------- reframed copy ---
# (namespace, key) -> {lang: new_value}
REFRAMES = {
    ('hero', 'badge'): {
        'en': 'Study RPG · Mastery Over Memorisation',
        'ar': 'Study RPG · الإتقان قبل الحفظ',
        'bn': 'Study RPG · মুখস্থের উপরে দক্ষতা',
        'de': 'Study RPG · Meisterschaft statt Auswendiglernen',
        'es': 'Study RPG · Dominio sobre la memorización',
        'fr': 'Study RPG · La maîtrise plutôt que la mémorisation',
        'hi': 'Study RPG · रटने से बेहतर निपुणता',
        'it': 'Study RPG · Padronanza, non memorizzazione',
        'ja': 'Study RPG · 暗記より習得',
        'ko': 'Study RPG · 암기보다 숙달',
        'nl': 'Study RPG · Meesterschap, geen memoriseren',
        'pt-BR': 'Study RPG · Domínio, não memorização',
        'ru': 'Study RPG · Мастерство, а не зубрёжка',
        'uk': 'Study RPG · Майстерність, а не зубріння',
        'zh': 'Study RPG · 掌握胜过死记硬背',
    },
    ('hero', 'titleLine1'): {
        'en': 'Study to Master,',
        'ar': 'ادرس لتتقن،',
        'bn': 'আয়ত্ত করতে পড়ুন,',
        'de': 'Lerne, um zu meistern,',
        'es': 'Estudia para dominar,',
        'fr': 'Étudiez pour maîtriser,',
        'hi': 'निपुण होने के लिए पढ़ें,',
        'it': 'Studia per padroneggiare,',
        'ja': '習得するために学び、',
        'ko': '숙달을 위해 공부하세요,',
        'nl': 'Studieer om te beheersen,',
        'pt-BR': 'Estude para dominar,',
        'ru': 'Учись, чтобы владеть,',
        'uk': 'Вчись, щоб володіти,',
        'zh': '为掌握而学习，',
    },
    ('hero', 'titleLine2'): {
        'en': 'Not Just Memorise.',
        'ar': 'لا مجرد حفظ.',
        'bn': 'শুধু মুখস্থ নয়।',
        'de': 'nicht nur auswendig lernen.',
        'es': 'no solo memorizar.',
        'fr': 'pas seulement mémoriser.',
        'hi': 'सिर्फ़ रटना नहीं।',
        'it': 'non solo memorizzare.',
        'ja': '暗記だけではありません。',
        'ko': '암기만 하지 마세요.',
        'nl': 'niet alleen memoriseren.',
        'pt-BR': 'não apenas memorizar.',
        'ru': 'а не просто зубрить.',
        'uk': 'а не просто зубрити.',
        'zh': '而不只是死记硬背。',
    },
    ('hero', 'description'): {
        'en': 'Upload notes and AI builds <strong>flashcards, quizzes & practice exams</strong> in seconds. Study daily with active recall, earn playtime rewards, and prove depth with teach-back — mastery over memorisation, free to win.',
        'ar': 'حمّل ملاحظاتك ويبني الذكاء الاصطناعي <strong>بطاقات تعليمية واختبارات وامتحانات تدريبية</strong> في ثوانٍ. ادرس يوميًا بالاسترجاع النشط، واربح مكافآت وقت اللعب، وأثبت العمق بالتعلّم بالتدريس — إتقان قبل الحفظ، وفوز مجاني.',
        'bn': 'নোট আপলোড করুন এবং AI সেকেন্ডে <strong>ফ্ল্যাশকার্ড, কুইজ ও প্র্যাকটিস পরীক্ষা</strong> তৈরি করে। অ্যাক্টিভ রিকলে দৈনিক পড়ুন, খেলার সময়ের পুরস্কার অর্জন করুন, আর টিচ-ব্যাকে গভীরতা প্রমাণ করুন — মুখস্থের উপরে দক্ষতা, ফ্রি-টু-উইন।',
        'de': 'Lade Notizen hoch und KI erstellt in Sekunden <strong>Karteikarten, Quizze & Übungsprüfungen</strong>. Lerne täglich mit aktivem Abrufen, verdiene Spielzeit-Belohnungen und beweise Tiefe mit Teach-back — Meisterschaft statt Auswendiglernen, fair gewonnen.',
        'es': 'Sube tus notas y la IA crea en segundos <strong>tarjetas, cuestionarios y exámenes de práctica</strong>. Estudia a diario con recuerdo activo, gana recompensas de tiempo de juego y demuestra profundidad con teach-back — dominio sobre memorización, gratis para ganar.',
        'fr': 'Importez vos notes et l\u2019IA crée en quelques secondes <strong>flashcards, quiz et examens blancs</strong>. Étudiez chaque jour par rappel actif, gagnez des récompenses de temps de jeu et prouvez la profondeur avec teach-back — la maîtrise plutôt que la mémorisation, gratuit pour gagner.',
        'hi': 'नोट्स अपलोड करें और AI सेकंडों में <strong>फ्लैशकार्ड, क्विज़ और प्रैक्टिस परीक्षाएँ</strong> बनाता है। सक्रिय स्मरण से रोज़ पढ़ें, खेल-समय के पुरस्कार पाएँ और टीच-बैक से गहराई साबित करें — रटने से बेहतर निपुणता, जीतने के लिए मुफ़्त।',
        'it': 'Carica gli appunti e l\u2019IA crea in pochi secondi <strong>flashcard, quiz ed esami di pratica</strong>. Studia ogni giorno con richiamo attivo, guadagna ricompense di tempo di gioco e dimostra profondità con teach-back — padronanza, non memorizzazione, gratis per vincere.',
        'ja': 'ノートをアップロードするとAIが数秒で<strong>フラッシュカード・クイズ・模擬試験</strong>を作成。アクティブリコールで毎日学び、遊び時間の報酬を得て、ティーチバックで深さを証明——暗記より習得、無料で勝てます。',
        'ko': '노트를 업로드하면 AI가 몇 초 만에 <strong>플래시카드, 퀴즈 & 연습 시험</strong>을 만듭니다. 능동적 회상으로 매일 공부하고, 놀이 시간 보상을 얻고, 티치백으로 깊이를 증명하세요 — 암기보다 숙달, 무료로 이기는 학습.',
        'nl': 'Upload notities en AI maakt in seconden <strong>flashcards, quizzen & oefenexamens</strong>. Studieer dagelijks met actief ophalen, verdien speeltijd-beloningen en bewijs diepte met teach-back — meesterschap boven memoriseren, gratis om te winnen.',
        'pt-BR': 'Envie suas anotações e a IA cria em segundos <strong>flashcards, quizzes e simulados</strong>. Estude diariamente com recordação ativa, ganhe recompensas de tempo de lazer e prove profundidade com teach-back — domínio, não memorização, grátis para vencer.',
        'ru': 'Загрузите конспекты, и ИИ за секунды создаст <strong>карточки, викторины и пробные экзамены</strong>. Учитесь ежедневно с активным припоминанием, получайте награды игровым временем и доказывайте глубину с teach-back — мастерство вместо зубрёжки, победа бесплатно.',
        'uk': 'Завантажте конспекти, і ШІ за секунди створить <strong>флешкартки, вікторини та пробні іспити</strong>. Вчіться щодня з активним пригадуванням, отримуйте нагороди ігровим часом і доводьте глибину через teach-back — майстерність, а не зубріння, чесна перемога.',
        'zh': '上传笔记，AI 几秒内生成<strong>闪卡、测验和模拟考试</strong>。通过主动回忆每日学习，赢取游戏时间奖励，用教回授证明深度——掌握胜过死记硬背，免费取胜。',
    },
    ('hero', 'startLearningFree'): {
        'en': 'Start Studying Free',
        'ar': 'ابدأ الدراسة مجانًا',
        'bn': 'বিনামূল্যে পড়া শুরু করুন',
        'de': 'Kostenlos mit dem Lernen starten',
        'es': 'Empieza a estudiar gratis',
        'fr': 'Commencer à étudier gratuitement',
        'hi': 'मुफ़्त में पढ़ाई शुरू करें',
        'it': 'Inizia a studiare gratis',
        'ja': '無料で学習を始める',
        'ko': '무료로 공부 시작',
        'nl': 'Begin gratis met studeren',
        'pt-BR': 'Comece a Estudar Grátis',
        'ru': 'Начать учиться бесплатно',
        'uk': 'Почати вчитися безкоштовно',
        'zh': '免费开始学习',
    },
    ('nav', 'tasks'): {
        'en': 'Missions', 'ar': 'المهام', 'bn': 'মিশন', 'de': 'Missionen', 'es': 'Misiones',
        'fr': 'Missions', 'hi': 'मिशन', 'it': 'Missioni', 'ja': 'ミッション', 'ko': '미션',
        'nl': 'Missies', 'pt-BR': 'Missões', 'ru': 'Миссии', 'uk': 'Місії', 'zh': '任务',
    },
    ('tasks', 'title'): {
        'en': 'Missions', 'ar': 'المهام', 'bn': 'মিশন', 'de': 'Missionen', 'es': 'Misiones',
        'fr': 'Missions', 'hi': 'मिशन', 'it': 'Missioni', 'ja': 'ミッション', 'ko': '미션',
        'nl': 'Missies', 'pt-BR': 'Missões', 'ru': 'Миссии', 'uk': 'Місії', 'zh': '任务',
    },
    ('tasks', 'subtitle'): {
        'en': 'Homework, assignments and projects are missions. Complete them to build memory skills and earn rewards.',
        'ar': 'الواجبات والتكليفات والمشاريع هي مهام. أنجزها لبناء مهارات الذاكرة وكسب المكافآت.',
        'bn': 'হোমওয়ার্ক, অ্যাসাইনমেন্ট ও প্রজেক্ট হলো মিশন। এগুলো সম্পূর্ণ করে স্মৃতির দক্ষতা গড়ুন এবং পুরস্কার অর্জন করুন।',
        'de': 'Hausaufgaben, Aufgaben und Projekte sind Missionen. Schließe sie ab, um Gedächtnisfähigkeiten aufzubauen und Belohnungen zu verdienen.',
        'es': 'Los deberes, trabajos y proyectos son misiones. Complétalas para desarrollar habilidades de memoria y ganar recompensas.',
        'fr': 'Les devoirs, travaux et projets sont des missions. Accomplissez-les pour développer des compétences de mémoire et gagner des récompenses.',
        'hi': 'होमवर्क, असाइनमेंट और प्रोजेक्ट मिशन हैं। इन्हें पूरा करके स्मृति कौशल बनाएँ और पुरस्कार पाएँ।',
        'it': 'Compiti, lavori e progetti sono missioni. Completali per sviluppare abilità di memoria e guadagnare ricompense.',
        'ja': '宿題・課題・プロジェクトはミッションです。完了して記憶力を高め、報酬を得ましょう。',
        'ko': '숙제, 과제, 프로젝트는 미션입니다. 완료해 기억력을 키우고 보상을 얻으세요.',
        'nl': 'Huiswerk, opdrachten en projecten zijn missies. Voltooi ze om geheugenvaardigheden op te bouwen en beloningen te verdienen.',
        'pt-BR': 'Deveres, trabalhos e projetos são missões. Complete-os para desenvolver habilidades de memória e ganhar recompensas.',
        'ru': 'Домашние задания, работы и проекты — это миссии. Выполняйте их, чтобы развивать память и получать награды.',
        'uk': 'Домашні завдання, роботи та проєкти — це місії. Виконуйте їх, щоб розвивати пам\u2019ять і отримувати нагороди.',
        'zh': '作业、任务和项目都是任务。完成它们，锻炼记忆能力并获得奖励。',
    },
    ('programmes', 'subtitle'): {
        'en': 'Optional frameworks that train your thinking — design systems that solve real study problems. All programmes are optional; your choice matters most.',
        'ar': 'أطر اختيارية تدرّب تفكيرك — صمّم أنظمة تحل مشكلات الدراسة الحقيقية. كل البرامج اختيارية؛ اختيارك هو الأهم.',
        'bn': 'আপনার চিন্তাকে প্রশিক্ষণ দেওয়ার ঐচ্ছিক কাঠামো — বাস্তব পড়ার সমস্যা সমাধানের সিস্টেম ডিজাইন করুন। সব প্রোগ্রামই ঐচ্ছিক; আপনার পছন্দই সবচেয়ে গুরুত্বপূর্ণ।',
        'de': 'Optionale Rahmenwerke, die dein Denken trainieren — entwirf Systeme, die echte Lernprobleme lösen. Alle Programme sind optional; deine Wahl zählt am meisten.',
        'es': 'Marcos opcionales que entrenan tu pensamiento: diseña sistemas que resuelven problemas reales de estudio. Todos los programas son opcionales; tu elección es lo más importante.',
        'fr': 'Des cadres facultatifs qui entraînent votre pensée — concevez des systèmes qui résolvent de vrais problèmes d\u2019étude. Tous les programmes sont facultatifs ; votre choix compte le plus.',
        'hi': 'ऐच्छिक ढाँचे जो आपकी सोच को प्रशिक्षित करते हैं — वास्तविक अध्ययन समस्याओं को हल करने वाली प्रणालियाँ बनाएँ। सभी प्रोग्राम ऐच्छिक हैं; आपकी पसंद सबसे मायने रखती है।',
        'it': 'Strutture facoltative che allenano il tuo pensiero — progetta sistemi che risolvono veri problemi di studio. Tutti i programmi sono facoltativi; la tua scelta conta più di tutto.',
        'ja': '思考力を鍛える任意参加の枠組み——実際の学習課題を解決するシステムを設計しよう。すべてのプログラムは任意参加。あなたの選択が最も大切です。',
        'ko': '사고력을 훈련하는 선택형 프레임워크 — 실제 학습 문제를 해결하는 시스템을 설계하세요. 모든 프로그램은 선택 사항이며, 당신의 선택이 가장 중요합니다.',
        'nl': 'Optionele kaders die je denken trainen — ontwerp systemen die echte studieproblemen oplossen. Alle programma\u2019s zijn optioneel; jouw keuze is het belangrijkst.',
        'pt-BR': 'Estruturas opcionais que treinam seu pensamento — crie sistemas que resolvem problemas reais de estudo. Todos os programas são opcionais; sua escolha é o que mais importa.',
        'ru': 'Добровольные рамки, которые тренируют мышление, — создавайте системы, решающие реальные проблемы учёбы. Все программы добровольны; ваш выбор важнее всего.',
        'uk': 'Добровільні рамки, які тренують мислення, — створюйте системи, що розв\u2019язують реальні проблеми навчання. Усі програми добровільні; ваш вибір найважливіший.',
        'zh': '可选的框架，训练你的思维——设计解决真实学习问题的系统。所有计划都是可选的；你的选择最为重要。',
    },
    ('factions', 'subtitle'): {
        'en': 'Study groups with one team leader. Weaker factions receive help from stronger ones — study by helping each other.',
        'ar': 'مجموعات دراسة يقودها قائد واحد. الفصائل الأضعف تتلقى المساعدة من الأقوى — الدراسة بالتعاون المتبادل.',
        'bn': 'একজন টিম লিডারের নেতৃত্বে পড়ার দল। দুর্বল গোষ্ঠী শক্তিশালীদের কাছ থেকে সাহায্য পায় — পরস্পরকে সাহায্য করে পড়া।',
        'de': 'Lerngruppen mit einem Teamleiter. Schwächere Fraktionen erhalten Hilfe von stärkeren — Lernen durch gegenseitige Hilfe.',
        'es': 'Grupos de estudio con un líder de equipo. Las facciones más débiles reciben ayuda de las más fuertes: estudiar ayudándose mutuamente.',
        'fr': 'Groupes d\u2019étude avec un chef d\u2019équipe. Les factions plus faibles reçoivent l\u2019aide des plus fortes — étudier en s\u2019entraidant.',
        'hi': 'एक टीम लीडर के नेतृत्व वाले अध्ययन समूह। कमज़ोर गुटों को मज़बूत गुटों से मदद मिलती है — एक-दूसरे की मदद से पढ़ाई।',
        'it': 'Gruppi di studio con un caposquadra. Le fazioni più deboli ricevono aiuto dalle più forti: studiare aiutandosi a vicenda.',
        'ja': '1人のチームリーダーが率いる学習グループ。弱いファクションは強いファクションから助けを受けます——助け合って学びます。',
        'ko': '팀 리더 한 명이 이끄는 학습 그룹. 약한 진영은 강한 진영의 도움을 받습니다 — 서로 돕는 학습.',
        'nl': 'Studiegroepen met één teamleider. Zwakkere fracties krijgen hulp van sterkere — studeren door elkaar te helpen.',
        'pt-BR': 'Grupos de estudo com um líder. Facções mais fracas recebem ajuda das mais fortes — estudar ajudando uns aos outros.',
        'ru': 'Учебные группы с одним лидером. Слабые фракции получают помощь от сильных — учиться, помогая друг другу.',
        'uk': 'Навчальні групи з одним лідером. Слабкі фракції отримують допомогу від сильних — вчитися, допомагаючи одне одному.',
        'zh': '由一名队长带领的学习小组。较弱的阵营会得到较强阵营的帮助——互相帮助，一起学习。',
    },
    ('examCentre', 'subtitle'): {
        'en': 'Competency-based testing — choose a subject, sharpen thinking skills, and get insights into why marks were lost and how to improve.',
        'ar': 'اختبارات قائمة على الكفاءة — اختر مادة، وصقل مهارات التفكير، واحصل على رؤى حول سبب خسارة الدرجات وكيفية التحسّن.',
        'bn': 'দক্ষতা-ভিত্তিক পরীক্ষণ — একটি বিষয় বেছে নিন, চিন্তার দক্ষতা বাড়ান, আর নম্বর কাটার কারণ ও উন্নতির উপায় জানুন।',
        'de': 'Kompetenzbasierte Tests — wähle ein Fach, schärfe deine Denkfähigkeiten und erfahre, warum Punkte verloren gingen und wie du dich verbesserst.',
        'es': 'Evaluación por competencias: elige una asignatura, agudiza tus habilidades de pensamiento y descubre por qué se perdieron puntos y cómo mejorar.',
        'fr': 'Évaluation par compétences — choisissez une matière, aiguisez votre pensée et découvrez pourquoi des points ont été perdus et comment progresser.',
        'hi': 'योग्यता-आधारित परीक्षण — विषय चुनें, सोचने के कौशल तेज़ करें, और जानें कि अंक क्यों कटे और कैसे सुधारें।',
        'it': 'Valutazione per competenze — scegli una materia, affina il pensiero e scopri perché hai perso punti e come migliorare.',
        'ja': 'コンピテンシー評価——科目を選び、思考力を磨き、なぜ点数を失ったのか、どう改善するのかがわかります。',
        'ko': '역량 기반 평가 — 과목을 고르고 사고력을 키우며, 어디서 점수를 잃었는지와 개선 방법을 알 수 있습니다.',
        'nl': 'Competentiegericht toetsen — kies een vak, scherp je denkvaardigheden aan en ontdek waarom punten verloren gingen en hoe je verbetert.',
        'pt-BR': 'Avaliação por competências — escolha uma matéria, aguce o pensamento e descubra por que pontos foram perdidos e como melhorar.',
        'ru': 'Тесты по компетенциям — выберите предмет, развивайте мышление и узнайте, почему потеряны баллы и как улучшиться.',
        'uk': 'Тестування компетенцій — оберіть предмет, розвивайте мислення та дізнайтеся, чому втрачено бали і як покращитись.',
        'zh': '能力测评——选择一门科目，锻炼思维能力，了解为什么丢分以及如何改进。',
    },
    ('howItWorks', 'description'): {
        'en': 'Import from anywhere, let AI build your study kit, then prove depth over length — master any subject with active recall and real-time analytics.',
        'ar': 'استورد من أي مكان، ودع الذكاء الاصطناعي يبني حقيبتك الدراسية، ثم أثبت العمق قبل الطول — أتقن أي مادة بالاسترجاع النشط والتحليلات الفورية.',
        'bn': 'যেকোনো জায়গা থেকে ইমপোর্ট করুন, AI-কে আপনার স্টাডি কিট বানাতে দিন, তারপর দৈর্ঘ্যের উপরে গভীরতা প্রমাণ করুন — অ্যাক্টিভ রিকল ও রিয়েল-টাইম অ্যানালিটিক্সে যেকোনো বিষয়ে দক্ষ হন।',
        'de': 'Importiere von überall, lass KI dein Lernkit bauen und beweise dann Tiefe statt Länge — meistere jedes Fach mit aktivem Abrufen und Echtzeit-Analysen.',
        'es': 'Importa desde cualquier lugar, deja que la IA construya tu kit de estudio y luego demuestra profundidad antes que longitud: domina cualquier materia con recuerdo activo y analíticas en tiempo real.',
        'fr': 'Importez de n\u2019importe où, laissez l\u2019IA construire votre kit d\u2019étude, puis prouvez la profondeur plutôt que la longueur — maîtrisez n\u2019importe quelle matière avec le rappel actif et des analyses en temps réel.',
        'hi': 'कहीं से भी इम्पोर्ट करें, AI से अपना स्टडी किट बनवाएँ, फिर लंबाई से पहले गहराई साबित करें — सक्रिय स्मरण और रीयल-टाइम एनालिटिक्स से किसी भी विषय में निपुण बनें।',
        'it': 'Importa da ovunque, lascia che l\u2019IA costruisca il tuo kit di studio e poi dimostra profondità prima della lunghezza — padroneggia qualsiasi materia con richiamo attivo e statistiche in tempo reale.',
        'ja': 'どこからでもインポートし、AIに学習キットを作らせ、長さより深さを証明——アクティブリコールとリアルタイム分析であらゆる科目を習得。',
        'ko': '어디서든 가져오고, AI가 학습 키트를 만들게 한 다음 길이보다 깊이를 증명하세요 — 능동적 회상과 실시간 분석으로 어떤 과목이든 숙달합니다.',
        'nl': 'Importeer van overal, laat AI je studiekit bouwen en bewijs daarna diepte boven lengte — beheers elk vak met actief ophalen en realtime statistieken.',
        'pt-BR': 'Importe de qualquer lugar, deixe a IA montar seu kit de estudo e prove profundidade em vez de extensão — domine qualquer matéria com recordação ativa e análises em tempo real.',
        'ru': 'Импортируйте откуда угодно, позвольте ИИ собрать учебный набор, затем докажите глубину вместо объёма — освойте любой предмет с активным припоминанием и аналитикой в реальном времени.',
        'uk': 'Імпортуйте звідки завгодно, дозвольте ШІ зібрати навчальний набір, потім доведіть глибину замість обсягу — опануйте будь-який предмет з активним пригадуванням та аналітикою в реальному часі.',
        'zh': '从任何地方导入，让 AI 打造你的学习工具包，然后证明深度优先于长度——通过主动回忆和实时分析掌握任何学科。',
    },
    ('cta', 'title'): {
        'en': 'Ready to Master,', 'ar': 'مستعد للإتقان،', 'bn': 'দক্ষতা অর্জনে প্রস্তুত,', 'de': 'Bereit zu meistern,',
        'es': '¿Listo para dominar,', 'fr': 'Prêt à maîtriser,', 'hi': 'निपुणता के लिए तैयार,', 'it': 'Pronto a padroneggiare,',
        'ja': '習得の準備はできましたか、', 'ko': '숙달할 준비가 되셨나요,', 'nl': 'Klaar om te beheersen,',
        'pt-BR': 'Pronto para dominar,', 'ru': 'Готовы овладеть,', 'uk': 'Готові опанувати,', 'zh': '准备好掌握，',
    },
    ('cta', 'titleHighlight'): {
        'en': 'Not Just Memorise?', 'ar': 'لا مجرد حفظ؟', 'bn': 'শুধু মুখস্থ নয়?', 'de': 'nicht nur auswendig lernen?',
        'es': 'no solo memorizar?', 'fr': 'pas seulement mémoriser ?', 'hi': 'सिर्फ़ रटना नहीं?', 'it': 'non solo memorizzare?',
        'ja': '暗記だけではありませんか？', 'ko': '암기만이 아닌가요?', 'nl': 'niet alleen memoriseren?',
        'pt-BR': 'não apenas memorizar?', 'ru': 'а не просто зубрить?', 'uk': 'а не просто зубрити?', 'zh': '而不只是死记硬背？',
    },
    ('cta', 'description'): {
        'en': 'Every mission, revision quiz and practice exam earns rewards — because real study is the only way to win. Free to win, always.',
        'ar': 'كل مهمة واختبار مراجعة وامتحان تدريبي يجلب مكافآت — لأن الدراسة الحقيقية هي السبيل الوحيد للفوز. فوز مجاني دائمًا.',
        'bn': 'প্রতিটি মিশন, রিভিশন কুইজ ও প্র্যাকটিস পরীক্ষা পুরস্কার আনে — কারণ সত্যিকারের পড়াই জেতার একমাত্র উপায়। সবসময় ফ্রি-টু-উইন।',
        'de': 'Jede Mission, jedes Wiederholungsquiz und jede Übungsprüfung bringt Belohnungen — denn echtes Lernen ist der einzige Weg zu gewinnen. Immer fair gewonnen.',
        'es': 'Cada misión, prueba de repaso y examen de práctica da recompensas — porque el estudio real es la única forma de ganar. Gratis para ganar, siempre.',
        'fr': 'Chaque mission, quiz de révision et examen blanc rapporte des récompenses — car la vraie étude est la seule façon de gagner. Gratuit pour gagner, toujours.',
        'hi': 'हर मिशन, रिवीज़न क्विज़ और प्रैक्टिस परीक्षा पुरस्कार देती है — क्योंकि असली पढ़ाई ही जीतने का एकमात्र तरीका है। हमेशा फ्री-टु-विन।',
        'it': 'Ogni missione, quiz di ripasso ed esame di pratica porta ricompense — perché lo studio vero è l\u2019unico modo per vincere. Sempre gratis per vincere.',
        'ja': 'すべてのミッション、復習クイズ、模擬試験が報酬をもたらします——本当の学習だけが勝利への道だからです。いつでも無料で勝てます。',
        'ko': '모든 미션, 복습 퀴즈, 연습 시험이 보상을 줍니다 — 진짜 공부만이 승리의 유일한 길이기 때문입니다. 언제나 무료로 승리하세요.',
        'nl': 'Elke missie, herhalingsquiz en oefenexamen levert beloningen op — want echt studeren is de enige manier om te winnen. Altijd gratis om te winnen.',
        'pt-BR': 'Cada missão, quiz de revisão e simulado rende recompensas — porque o estudo real é a única forma de vencer. Grátis para vencer, sempre.',
        'ru': 'Каждая миссия, контрольный тест и пробный экзамен приносят награды — потому что настоящая учёба — единственный путь к победе. Всегда честная победа.',
        'uk': 'Кожна місія, контрольний тест і пробний іспит приносять нагороди — бо справжнє навчання єдиний шлях до перемоги. Завжди чесна перемога.',
        'zh': '每个任务、复习测验和模拟考试都会带来奖励——因为真正的学习才是唯一获胜之道。永远免费取胜。',
    },
}


def rename_brand(data):
    """Recursively replace the old product name with 'Study RPG' in every string."""
    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, str):
                data[k] = v.replace('Studyield', 'Study RPG')
            else:
                rename_brand(v)
    elif isinstance(data, list):
        for i, v in enumerate(data):
            if isinstance(v, str):
                data[i] = v.replace('Studyield', 'Study RPG')
            else:
                rename_brand(v)


def apply_file(lang: str) -> None:
    path = os.path.join(ROOT, f'{lang}.json')
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    # 0. rebrand every string (testimonials, FAQ, about, contact, pricing...)
    rename_brand(data)

    # 1. appName rebrand
    if data.get('common', {}).get('appName') != 'Study RPG':
        data['common']['appName'] = 'Study RPG'
        print(f'  {lang}: appName -> Study RPG')

    # 2. philosophy namespace (idempotent)
    if 'philosophy' not in data:
        data = {'philosophy': PHILOSOPHY[lang], **data}
        print(f'  {lang}: philosophy namespace inserted')

    # 3. reframed values (namespace-aware)
    for (ns, key), values in REFRAMES.items():
        if ns in data and key in data[ns]:
            data[ns][key] = values[lang]
            print(f'  {lang}: {ns}.{key} = {values[lang][:44]}{"..." if len(values[lang]) > 44 else ""}')
        else:
            print(f'  ! {lang}: missing {ns}.{key}')

    # validate + write preserving literal UTF-8
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    # re-validate
    with open(path, encoding='utf-8') as f:
        json.load(f)
    print(f'  {lang}: OK, JSON valid')


def main() -> int:
    for lang in LANGS:
        print(f'== {lang} ==')
        apply_file(lang)
    print('All locales updated.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
