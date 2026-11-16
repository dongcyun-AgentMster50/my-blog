/* ============================================================
   tests/fixtures/srclang-8n-corpus.mjs — 8n(스페인어 원문 언어) 회귀 말뭉치 (spec 19-1-3 §5)

   `srclang-8n.golden.json` 은 이 말뭉치를 **8n 이전(HEAD b767dd7) 모듈**로 돌린 결과다 —
   `guessLang` 과 `splitSentences(s, {lang})`(en·fr·ko). 테스트가 지금 모듈의 결과와 글자 단위로 대조한다
   (7c E1 꼴: 두 쪽을 같은 코드로 만들면 함께 바뀌어도 초록이라 옛 결과를 굳혀 둔다).
   말뭉치를 바꾸면 golden 을 옛 모듈로 다시 만들어야 한다 — 바꾸지 마라(더할 거면 새 묶음으로).

   문장은 전부 직접 지었다(원서 문장 없음). en·fr·ko·zh·ja·ar 발췌는 tests/lang.test.mjs 의 것과 같다.
   ============================================================ */

const EN = 'The patient presented with a persistent cough and mild fever for three weeks. ' +
  'Chest examination revealed crackles in both lower lobes, and the white cell count was raised. ' +
  'Treatment with oral antibiotics was started, and the symptoms improved within ten days.';

const FR = 'Le patient présentait une toux persistante et une fièvre modérée depuis trois semaines. ' +
  'L’examen du thorax a révélé des crépitants dans les bases, et la numération des leucocytes était élevée. ' +
  'Un traitement antibiotique par voie orale a été débuté pour une durée de dix jours.';

const KO = '환자는 3주 동안 이어진 기침과 가벼운 발열로 내원하였다. ' +
  '흉부 청진에서 양쪽 아래 폐에 수포음이 들렸고 백혈구 수가 증가해 있었다. ' +
  '경구 항생제 치료를 시작하였고 열흘 안에 증상이 좋아졌다. ';

const ZH = '患者咳嗽持续三周并伴有低热。胸部检查发现双下肺湿啰音，白细胞计数升高。开始口服抗生素治疗后，症状在十天内明显好转。';
const JA = '患者は三週間続く咳と微熱で来院した。胸部の聴診で両側の下肺に水泡音を認め、白血球数が上昇していた。経口抗菌薬を開始したところ、十日以内に症状は改善した。';
const AR = 'حضر المريض بسعال مستمر وحمى خفيفة منذ ثلاثة أسابيع. ' +
  'أظهر فحص الصدر خراخر في القاعدتين، وكان عدد الكريات البيض مرتفعًا. ' +
  'بدأ العلاج بالمضادات الحيوية الفموية وتحسنت الأعراض خلال عشرة أيام.';

/** 지어낸 스페인어 4문장(+ 여는 물음표·느낌표 2문장). 원서 문장이 아니다. */
export const ES = 'El paciente llegó al hospital con fiebre alta y tos persistente desde hace una semana. ' +
  'Los médicos revisaron las radiografías del tórax y encontraron una lesión en el pulmón derecho. ' +
  'Por la noche se inició el tratamiento con antibióticos para controlar la infección. ' +
  'Lo más importante es descansar y beber mucha agua. ' +
  '¿Cuánto tiempo durará la recuperación? ¡Lo sabremos pronto!';

/** 200자를 넘을 때까지 되풀이(문장을 새로 짓지 않는다). */
export function atLeast200(s) {
  let out = s;
  while (out.length < 220) out += ' ' + s;
  return out;
}

function rep(unit, n) {
  let s = unit;
  while (s.length < n) s += unit;
  return s;
}

/** `guessLang` 말뭉치 — [이름, 글]. es 가 이기지 않아야 하는 입력만(8n 이전 결과와 같아야 한다). */
export const GUESS_CASES = Object.freeze([
  ['en', EN],
  ['fr', FR],
  ['ko', atLeast200(KO)],
  ['zh', atLeast200(ZH)],
  ['ja', atLeast200(JA)],
  ['ar', atLeast200(AR)],
  ['short-empty', ''],
  ['short-fr', 'Le patient.'],
  ['short-fr150', FR.slice(0, 150)],
  ['short-ko', KO],
  ['short-zh', ZH],
  ['short-es', 'El paciente está bien.'],
  ['tie-en-fr', rep('the patient le malade and fever et fièvre with care pour soin ', 260)],
  ['no-function-words', rep('Cardiomyopathy hypertrophic obstructive variant ', 260)],
  ['en-etal', EN + ' Smith et al. reported the same course, and Jones et al. found it in the elderly.'],
  ['en-kana', EN + ' (カルテ)'],
  ['ko-abbrev', atLeast200('CRP 수치는 12 mg/L 이었고 ECG 는 정상이었다. ' + KO)],
  ['ko-30-50', rep('고혈압(hypertension) 환자에게는 암로디핀 또는 losartan 을 먼저 투여하고 blood pressure 를 다시 잰다. ', 260)],
  ['fr-1.5x', rep('le malade et la fièvre the patient and cough ', 260)],
  /* 8n 경계 — es 낱말이 섞였지만 en·fr 중 큰 쪽의 2배에 못 미친다 → 8n 이전과 같아야 한다. */
  ['b-fr-es', rep('le malade et la fièvre the cough con el ', 260)],          // fr 3 · en 1 · es 2 → fr
  ['b-en-es', rep('the patient and the cough with fever con el lo malade ', 260)], // en 4 · es 3 → en, score 1
  ['b-es-max-under2x', rep('con el lo para por the and of tos ', 260)],     // es 5 · en 3 → es 가 최다지만 2배 미만 → en
  ['b-en-with-es-quote', EN + ' The motto read "por la vida y para el pueblo" in old letters.'],
  ['b-fr-with-es-quote', FR + ' La devise disait « con el pueblo » en lettres anciennes.'],
  ['b-ko-with-es', atLeast200('환자에게 "el dolor es fuerte" 라고 들었다. ' + KO)],
  ['b-und-latin-es-words-zero', rep('Lorem ipsum dolor sit amet consectetur ', 260)]
]);

/** `splitSentences` 말뭉치 — en·fr·ko 각각으로 나눈다(8n 이전 결과와 같아야 한다). */
export const SPLIT_CASES = Object.freeze([
  'Fever was noted in 3 of 10 cases. It resolved.',
  'Use e.g. the second form. Then stop.',
  'Dr. Kim saw the patient at 9 a.m. today. The rash was gone.',
  'The dose was 2.5 mg. (See Table 4.) Repeat in 6 h.',
  'He said "stop." Then he left! Why? Nobody knows…  Later it rained.',
  'J. R. Smith et al. described it. The cohort was small.',
  'Values were high. éarly morning samples differed. Évitez is French, not English.',
  'The test was positive. 환자는 좋아졌다. Another line.',
  'Ends with abbreviation vs. Continues here. Fig. 3 shows it.',
  'Lower case after period. and it continues. «Quoted» start. [Bracket] start.',
  'I-42. An 18-year-old man. A. Primary option. The answer is C.',
  '   lots   of\n spaces.   Next\tsentence here.  ',
  '',
  'No terminal punctuation at all',
  'La fièvre a cédé. Évitez les anti-inflammatoires. Ça suffit.',
  'Voir p. ex. la suite. puis rien.',
  '환자는 열이 있었다. 항생제를 시작하였다. CRP 는 정상이었다.',
  /* 8n — 여는 ¿¡ 는 en·fr·ko 규칙에서 문장 시작이 아니다(8n 이전 그대로 이어 붙는다). */
  'The sign said hola. ¿Qué tal? ¡Muy bien! Then we left.',
  'Il a dit bonjour. ¿Qué tal? ¡Muy bien! Puis il est parti.',
  '그는 인사했다. ¿Qué tal? ¡Muy bien! 그리고 떠났다.',
  ES,
  'Sr. García llegó. Sra. López también. El Dr. Ruiz no.',
  'See [PMID 12345]. ¿Next? Item one. • Bullet two • Bullet three.'
]);

export const SPLIT_LANGS = Object.freeze(['en', 'fr', 'ko']);

/* ── `[8n-b]` 보통 꼴 묶음 — golden 과 무관(위 말뭉치는 그대로). 전부 지어낸 글이다. ──────────
 * `ES` 는 el·los·del·por·para·con·lo 를 일부러 많이 넣은 꼴(es/fr 5배)이라 "보통 스페인어가 fr 로
 * 가는" 구멍을 못 봤다. 아래는 여성 명사가 많아 `la` 가 흔한 보통 꼴이다(es 기능어가 둘뿐인 것도 있다).
 * 앞 여섯은 8n Review(r8n/es-margin) 가 지은 것, 뒤 넷은 8n-b Build 가 지은 것(의학·일상·설명문). */
export const ES_NATURAL = Object.freeze([
  ['r-fem', 'La insuficiencia cardiaca es una enfermedad frecuente en la población anciana. La disnea aparece primero con el esfuerzo y después en reposo. La exploración muestra edema en las piernas y crepitantes en la base de los pulmones. La radiografía de tórax confirma la congestión y la ecografía mide la fracción de eyección. La primera medida es reducir la sal en la dieta y vigilar el peso cada mañana.'],
  ['r-fem2', 'La paciente presenta cefalea intensa, náuseas y rigidez de nuca desde la mañana. La temperatura es de treinta y nueve grados y la presión arterial está baja. Se solicita una punción lumbar urgente y se inicia la antibioterapia empírica sin esperar la tomografía. La evolución en las primeras horas determina la necesidad de ingreso en la unidad de cuidados intensivos.'],
  ['r-textbook', 'El diagnóstico de la diabetes se basa en la glucemia en ayunas, la hemoglobina glicosilada o la prueba de tolerancia oral. Los pacientes con valores intermedios tienen un riesgo elevado y deben recibir consejo sobre la dieta y el ejercicio. El tratamiento inicial suele ser la metformina, salvo que exista una contraindicación renal. Para los pacientes con enfermedad cardiovascular se prefieren fármacos con beneficio demostrado.'],
  ['r-dialog', '¿Desde cuándo tiene usted la tos? Desde hace dos semanas, doctor. ¿Ha tenido fiebre? Sí, por la noche sobre todo. ¿Fuma? No, lo dejé hace años. Vamos a hacer una radiografía y un análisis de sangre. Si todo sale bien, la tos se irá sola con reposo y líquidos. ¡No se preocupe!'],
  ['r-shortfem', 'La anemia ferropénica es la causa más frecuente de anemia en la mujer joven. La pérdida menstrual abundante y la dieta pobre en hierro explican la mayoría de los casos. La ferritina baja confirma la sospecha y la respuesta al hierro oral aparece en pocas semanas.'],
  ['r-neutral', 'Los antibióticos deben usarse solo cuando hay una infección bacteriana probable. En los niños con otitis media leve se puede esperar dos o tres días antes de empezar el tratamiento. Si el dolor aumenta o aparece fiebre alta, el médico revisa de nuevo al niño y decide si necesita amoxicilina. Los padres reciben instrucciones claras por escrito.'],
  ['b-hta', 'La hipertensión arterial es una enfermedad crónica muy común en la edad adulta. La mayoría de las personas no tienen síntomas durante años, por lo que la medición periódica de la presión es fundamental. Cuando la cifra supera los valores normales en varias visitas, la médica recomienda cambios en la alimentación y la actividad física antes de indicar un fármaco.'],
  ['b-neumonia', 'La neumonía adquirida en la comunidad es una infección frecuente en la población mayor. La tos con expectoración, la fiebre y la dificultad respiratoria son las manifestaciones más habituales. La auscultación revela crepitantes en la zona afectada y la radiografía confirma la consolidación. La elección del antibiótico depende de la gravedad y de la edad de la paciente.'],
  ['b-panaderia', 'Esta mañana fui a la panadería de la esquina y compré una barra de pan y unas galletas para la merienda. La señora que atiende siempre me pregunta por mi madre y le cuento cómo está. Después pasé por la farmacia porque necesitaba crema para la piel y unas tiritas.'],
  ['b-fotosintesis', 'La fotosíntesis es el proceso mediante el cual las plantas transforman la luz del sol en energía química. En la hoja, la clorofila capta la luz y la usa para convertir el agua y el dióxido de carbono en glucosa. Como resultado, la planta libera oxígeno a la atmósfera, lo que permite la vida de muchos otros seres.']
]);

/** `[8n-b]` 보통 꼴 프랑스어 — fr 그대로여야 한다(`la` 를 es 비교에서 빼도). 앞 다섯은 8n-b Build, 뒤 둘은 8n Review 가 지은 것. */
export const FR_NATURAL = Object.freeze([
  ['b-hta', 'L’hypertension artérielle est une maladie chronique fréquente chez l’adulte. La plupart des patients n’ont aucun symptôme pendant des années, ce qui rend la mesure régulière de la pression indispensable. Lorsque les chiffres restent élevés, le médecin propose d’abord des changements du mode de vie avant de prescrire un traitement.'],
  ['b-pneumonie', 'La pneumonie communautaire est une infection fréquente chez la personne âgée. La toux, la fièvre et la gêne respiratoire sont les signes les plus habituels. L’auscultation retrouve des crépitants dans la zone atteinte et la radiographie confirme la condensation. Le choix de l’antibiotique dépend de la gravité et de l’âge de la patiente.'],
  ['b-boulangerie', 'Ce matin, je suis allé à la boulangerie du coin pour acheter une baguette et des croissants. La vendeuse m’a demandé des nouvelles de ma mère et je lui ai raconté la semaine. Ensuite je suis passé à la pharmacie pour une crème et des pansements.'],
  ['b-photosynthese', 'La photosynthèse est le processus par lequel les plantes transforment la lumière du soleil en énergie chimique. Dans la feuille, la chlorophylle capte la lumière et l’utilise pour convertir l’eau et le dioxyde de carbone en glucose. La plante libère alors de l’oxygène dans l’atmosphère.'],
  ['b-vaccin', 'Le vaccin stimule la réponse immunitaire sans provoquer la maladie. Après l’injection, la zone peut être douloureuse et la température monter un peu pendant un ou deux jours. La protection complète arrive quelques semaines après la seconde dose.'],
  ['r-fr2', 'Il y a souvent une douleur thoracique au repos. Le médecin a su reconnaître les signes et il y a eu une amélioration rapide. La patiente y est retournée pour un contrôle, et son état était stable. Il n’y a pas eu de récidive au cours du suivi.'],
  ['r-fr3', 'La maladie de Crohn touche surtout les jeunes adultes. Elle se manifeste par des douleurs abdominales, une diarrhée chronique et un amaigrissement. Le diagnostic repose sur la coloscopie avec biopsies et sur l’imagerie. Le traitement dépend de la localisation et de la sévérité.']
]);

/* ── `[8n-c]` 프랑스어 2인칭 `tu es`·`t'es` 꼴 — golden 과 무관. 전부 지어낸 글이다. ──────────────
 * 짧은 반말 글(편지·아이에게·메시지)에 `tu es` 가 잦고 `la` 밖의 fr 기능어가 적으면, 8n-b 판(`la` 를 es 비교에서
 * 뺀 판)은 `es` 를 스페인어로 세어 es 로 판정했다. 앞 다섯은 8n-b Review(r8nb/fr-tues) 가, 뒤 여섯은 8n-c Build 가
 * 지은 것(뒤 여섯 중 다섯이 8n-b 판에서 es). fr 그대로·8n 이전 규칙과 같은 값이어야 한다. */
export const FR_TUES = Object.freeze([
  ['r-lettre', 'Ma chérie, tu es la lumière de ma vie. Tu es la raison de mon sourire chaque matin. Quand tu es loin, la maison semble vide et la nuit paraît longue. Tu es la plus belle chose qui me soit arrivée, et je pense à toi à chaque instant de la journée.'],
  ['r-enfant', 'Tu es grand maintenant. Tu es capable de ranger ta chambre tout seul, de préparer ton cartable et de mettre la table. Tu es courageux quand tu vas chez la dentiste. Bravo, mon fils, tu es vraiment devenu un petit homme dont je suis fière.'],
  ['r-coach', 'Tu es plus fort que tu ne le crois. Tu es capable de franchir la ligne d’arrivée. Respire, garde la tête haute et avance à ta façon. Tu es prêt : la course commence maintenant, la foule t’attend, la victoire est à portée de main.'],
  ['r-patient', 'Docteur, je suis inquiète pour ma fille. Tu es sûre que ce n’est rien ? me demande-t-elle. Tu es fatiguée, lui dis-je, la fièvre va baisser. Mais la toux continue, la nuit surtout, et la respiration siffle un peu quand elle court.'],
  ['r-tutoie-court', 'Tu es là ? Tu es réveillée ? La réunion commence bientôt. Tu es la seule à connaître la réponse, alors prépare la présentation. Tu es attendue à la salle trois, la porte au fond du couloir à gauche, près de la machine à café.'],
  ['c-sms', 'T’es où ? T’es encore au bureau ? La pizza arrive bientôt, la télé attend. Tu es toujours en retard le vendredi, mais ce soir c’est la finale. Dépêche-toi : t’es mon invité préféré, la place à côté de moi reste vide sans toi, alors cours vite !'],
  ['c-grandmere', 'Ma petite, tu es la joie de ma vieillesse. Quand tu es là, la cuisine sent la cannelle. T’es sage, t’es gentille, tu es la seule à rire de mes histoires. Reviens vite me voir avec ta sœur ; la tarte aux pommes sera prête, comme toujours, à quatre heures.'],
  ['c-medecin-ami', 'Écoute, tu es épuisé. T’es pâle, tu dors mal, ta toux ne passe pas. Tu es allé voir la pharmacienne ? Prends ta température ce soir, repose-toi. Si ça monte, appelle-moi tout de suite : je passerai chez toi avant ma consultation de midi.'],
  ['c-sport', 'Allez, tu es presque arrivé ! T’es à deux kilomètres de la ligne. Garde ta cadence, respire avec ta musique, ça monte encore un peu. Tu es plus solide que la semaine passée ; tu es capable, tu es prêt, ta médaille t’attend au bout de la rue.'],
  ['c-dispute', 'Tu es injuste avec moi. T’es partie sans un mot hier soir, ta porte a claqué si fort que ma voisine est montée. Tu es fâchée, je le vois bien, mais j’ai seulement oublié notre réservation. Pardonne-moi : samedi soir sera à nous deux, promis.'],
  ['c-classe', 'Tu es prête pour ta dictée ? T’es toujours la première à finir ta page. Relis ta phrase trois, il manque une virgule après ta date. Tu es attentive, alors vérifie aussi ta fin de texte avant la sonnerie ; tu es capable de tout réussir.']
]);

/** `[8n-c]` 스페인어 덧 — `t es`(수식 변수 — 아포스트로피 없음)·소유 형용사 `tu`·`¿Tú eres?` 가 있어도 es. 8n-c Build 가 지음. */
export const ES_TU = Object.freeze([
  ['c-fisica', 'En la ecuación del movimiento, donde t es el tiempo y v es la velocidad, la posición final depende de la aceleración inicial. Si la fuerza es constante, la gráfica es una recta. Para el caso de la caída libre, la aceleración es la de la gravedad, con un valor cercano a diez.'],
  ['c-carta', 'Querida amiga: tu carta llegó por fin y la leí con mucha alegría. ¿Tú eres la misma de siempre? Tu hermana me contó que la casa nueva es preciosa y que el jardín está lleno de flores. Escríbeme pronto y cuéntame todo lo de la boda de tu prima.']
]);

/* ── `[8n-d]` 프랑스어 2인칭 `es` 의 다른 꼴 — golden 과 무관. 전부 지어낸 글이다. ──────────────────────
 * 앞 다섯은 8n-c Review(r8nc/es-other) 가 지은 것 — 도치 `es-tu`·부정 `n'es`·`tu en es`·`tu y es`(8n-c 판에서 넷이 es).
 * 뒤 열둘은 8n-d Build 가 지은 것 — 반말 짧은 글, `tu n'y es`·`qu'es-tu`·`toi qui es`·`t'en es`·`tu l'es`·`n'en es` 꼴.
 * es 묶음에서 `es` 를 뺀 뒤로는 어느 꼴이든 es 가 될 수 없다 — 모두 8n 이전 규칙과 같은 값이어야 한다. */
export const FR_ES_FORMS = Object.freeze([
  ['x-inversion', "Où es-tu ? Es-tu encore à la gare ? Pourquoi es-tu parti si vite ce matin ? Ta sœur m'a appelée, elle s'inquiète. Es-tu fâché contre moi ? Réponds vite, la soirée commence bientôt et ta place reste vide à côté de la fenêtre."],
  ['x-negation', "Tu n'es pas seul, mon ami. Tu n'es pas obligé de tout porter. Si tu n'es pas prêt demain, ce n'est pas grave : la réunion peut attendre. Repose-toi, mange un peu, appelle ta mère. Ta santé compte plus que ta carrière, crois-moi."],
  ['x-mix', "Tu n'es jamais à l'heure ! Où es-tu encore ? T'es vraiment impossible. Es-tu au moins réveillé ? La voiture attend en bas, ta valise aussi. Si tu n'es pas là dans dix minutes, je pars sans toi, ma parole, et tant pis pour la plage."],
  ['x-en-y', "Où en es-tu avec ta thèse ? Tu en es à quel chapitre ? Moi, j'y suis presque, mais toi, tu y es depuis trois ans. Tu n'es pas en retard, rassure-toi, chacun avance à sa vitesse. Envoie-moi ta table des matières ce soir, si tu veux."],
  ['x-coach-inv', "Es-tu prêt ? Es-tu concentré ? Tu n'es pas venu ici pour perdre. Respire, regarde la piste, sens ta force. Qui es-tu ? Un champion. Pourquoi es-tu là ? Pour gagner. Alors cours, ne regarde pas derrière toi, la ligne t'attend."],
  ['d-consolation', "Ne pleure pas, ma puce. Tu n'y es pour rien, c'est un accident. Le vase était vieux et tu n'es pas maladroite, tu es juste fatiguée. Viens, on ramasse les morceaux ensemble et après, on prend un chocolat chaud avant de dormir."],
  ['d-retrouvailles', "Qu'es-tu devenu depuis le lycée ? Où en es-tu de ta vie ? Moi, je suis toujours à Lyon, avec mon chien et mes plantes. Toi qui es parti si loin, raconte-moi tout : ton travail, ta maison, ton accent canadien. Écris-moi vite !"],
  ['d-enfant', "Maman, tu es où ? Tu es fâchée ? Pourquoi tu ne réponds pas ? Je suis dans ma chambre, j'ai fini mes devoirs. Si tu es d'accord, je peux aller chez Paul ? Sa mère nous emmène au parc et on rentre avant six heures, promis."],
  ['d-collegue', "T'en es où avec ton dossier ? Tu l'es vraiment, débordé, ou tu fais semblant ? Franchement, t'es pas obligé de tout accepter. Dis non au chef de temps en temps. Toi, tu es trop gentil, et lui le sait très bien."],
  ['d-sms', "Coucou ! Tu es bien arrivée ? T'es pas trop fatiguée ? Ici tout va bien, le chat dort sur ton lit depuis ton départ. Profite bien de la mer, envoie des photos, et repose-toi : tu le mérites. On t'attend dimanche pour le dîner."],
  ['d-carte', "Joyeux anniversaire, mon vieux ! Tu es encore plus vieux que moi, ha ! Si tu n'es pas trop occupé samedi, on t'invite au restaurant du port. Tu es libre vers vingt heures ? Réponds vite pour la réservation, la table est petite."],
  ['s-nyes', "Tu n'y es pour rien, ma grande. Ce n'était pas ta faute : la pluie, la route glissante, la nuit. Tu n'y es pour rien et personne ne te reproche quoi que ce soit. Dors un peu, demain on verra ça au calme avec ton père."],
  ['s-quies', "Toi qui es si douce, toi qui es si patiente, pourquoi cries-tu ce soir ? Toi qui es toujours calme avec ta classe, avec ta sœur, avec moi. Viens t'asseoir, raconte-moi ta journée, je t'écoute sans juger, promis, ma chérie."],
  ['s-tenes', "T'en es où ? T'en es à quelle page de ton roman ? Moi j'en suis au chapitre deux, ça avance lentement. Toi, t'en es sûrement à la fin, comme toujours. Envoie-moi ta suite ce soir, j'ai hâte de lire ta prochaine scène."],
  ['s-tules', "Fatigué ? Tu l'es, ça se voit sur ta figure. Content ? Tu l'es aussi, je crois, malgré ta nuit blanche. Prêt pour ton examen ? Tu l'es, j'en suis sûre, alors respire, mange un peu, bois ton café et pars sans courir."],
  ['s-nenes', "Tu n'en es pas à ta première erreur, alors ne pleure pas. Tu n'en es qu'au début de ta carrière, mon petit. Chacun apprend à sa façon : moi aussi, j'ai raté beaucoup de choses. Relève ta tête, souris, appelle ta cheffe ce soir."],
  ['s-mix2', "Qu'es-tu allé faire là-bas ? Tu n'y es resté qu'une heure. Toi qui es si prudent d'habitude ! T'en es revenu tout pâle, ta veste déchirée. Raconte-moi ce qui s'est passé, je ne dirai rien à ta mère, promis, juré."]
]);

/** `[8n-d]` 짧은 스페인어 열둘 — 8n-d Build 가 지음. 앞 여섯은 보통 꼴, 뒤 여섯은 `la` 가 많고 `es` 밖의 es 기능어가 적은 꼴.
 *  `es` 를 묶음에서 뺀 값(대가): es 기능어가 하나뿐인 `z-gripe`·`z-ciudad` 는 es 가 아니라 8n 이전 값(fr)이다. */
export const ES_SHORT = Object.freeze([
  ['d-presentacion', 'Hola, me llamo Marta y soy de Valencia. Mi hermano es profesor y mi madre es enfermera en un hospital de la ciudad. Los fines de semana vamos a la playa con mis primos, y en verano pasamos un mes en el pueblo de mis abuelos.'],
  ['d-mensaje', '¿Dónde estás? Te espero en la puerta del cine desde hace veinte minutos. La película empieza a las nueve y no quiero perder el principio. Si no llegas pronto, entro sola y te guardo un asiento al final de la fila, junto al pasillo.'],
  ['d-receta', 'Mezcla la harina con dos huevos y un poco de leche. Bate la masa hasta que quede lisa y déjala reposar media hora. Calienta la sartén, echa un cucharón y dale la vuelta cuando salgan burbujas. Sirve las tortitas con miel o fruta.'],
  ['d-opinion', 'Para mí, la salud es lo más importante. Comer bien es fácil si planificas la semana. Dormir ocho horas es necesario y caminar cada día es un hábito sencillo. No es caro ni es difícil: es cuestión de constancia y de paciencia.'],
  ['d-clima', 'Mañana habrá lluvias en el norte y nieve en las montañas. En la costa, el cielo estará nublado por la mañana y despejado por la tarde. Las temperaturas bajarán unos grados y el viento soplará con fuerza en las islas.'],
  ['d-abuela', 'Mi abuela es muy mayor, pero es fuerte. Es la persona más alegre que conozco y siempre canta en la cocina. Mi abuelo es más tranquilo: lee el periódico, riega las plantas y duerme la siesta. Es una pareja feliz y es un placer visitarlos.'],
  ['z-gripe', 'La gripe es una infección vírica muy contagiosa. La fiebre es alta y la tos es seca. La recuperación es lenta en la persona mayor, y la vacuna anual es la mejor prevención. Si la fiebre dura más de tres días, consulte a su médico.'],
  ['z-casa', 'Mi casa es pequeña pero es muy luminosa. La cocina es nueva y la terraza es mi rincón favorito: tengo plantas, una mesa y dos sillas. La vecina de arriba es muy amable y a veces me trae fruta de su huerto.'],
  ['z-asma', 'El asma es una enfermedad crónica de la vía aérea. La inflamación es variable y la obstrucción es reversible. La espirometría confirma la sospecha y la educación del paciente es la clave de un buen control a largo plazo.'],
  ['z-ciudad', 'Sevilla es una ciudad preciosa. La catedral es enorme y la Giralda es su torre más famosa. En primavera la ciudad huele a azahar y la gente sale a la calle. La comida es buena y barata, y la música es parte de la vida diaria.'],
  ['z-migrana', 'La migraña es frecuente en la mujer joven. La cefalea es pulsátil, a menudo unilateral, y la luz molesta mucho. La crisis dura horas y la paciente necesita reposo en una habitación oscura y silenciosa hasta que pasa.'],
  ['z-perra', 'Nuestra perra es muy lista. Es tranquila en casa y es la reina del parque. La llevamos al veterinario cada año y siempre dice que está sana. Es una compañera fiel y la familia entera la adora, sobre todo mi hija pequeña.']
]);

/* ── `[8n-e]` 채움 도우미 — 200자 미만 글만 **숫자**로 200자까지 채운다. ──────────────────────────────────
 * `atLeast200` 은 220자가 될 때까지 글을 되풀이해서 200–219자 글의 기능어 수를 두 배로 만들었다(8n-d 재검증 낮음-2 —
 * `z-casa`·`z-migrana` 가 그 때문에 es). 숫자는 낱말(`\p{L}+`)·글자 계통 셈에 들지 않으므로 기능어 수·비율·score 가
 * 글 그대로이고 200자 문턱만 넘긴다. golden 묶음(`GUESS_CASES`)은 `atLeast200` 그대로 — 바꾸면 golden 이 달라진다. */
export function padTo200(s) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length >= 200 ? s : t + ' ' + '0'.repeat(199 - t.length);
}

/* ── `[8n-e]` 스페인어 고유명사·저자명이 든 프랑스어·영어 — golden 과 무관. 8n-d Review(r8nd) 가 지은 글, 글자 그대로. ──
 * 대문자 `Los`·`Las`·`El`·`Del`·`Con` 이 es 기능어로 세어져 8n-d 판에서 `f-itineraire`·`f-biblio`·`e-refs-delrio`·
 * `e-refs-conA`·`ref-hisp2`·`ref-hisp3`·`ref-hisp6` 이 es 였다. 모두 8n 이전 값이어야 한다.
 * `ref-*` 셋은 r8nd/eval2-sets 의 `mix()` 가 만든 글을 펼쳐 적은 것(195·272·559자). */
export const PROPER_FR = Object.freeze([
  ['f-los-angeles', "Tu es à Los Angeles jusqu'à quand ? Tu es allé voir Venice Beach ? Ici à Paris il pleut sans arrêt. Toi qui es parti au soleil, envoie-nous des photos ! Et n'oublie pas ta crème solaire, tu es toujours rouge comme une tomate au bout d'une heure."],
  ['f-el-nino', "Le phénomène El Niño revient cette année. Selon les météorologues, El Niño pourrait provoquer des sécheresses en Australie et des pluies violentes au Pérou. Les agriculteurs de la côte pacifique se préparent déjà, et les assureurs suivent la situation de près."],
  ['f-vegas-delrio', "Notre voyage : trois jours à Las Vegas, puis la route vers Del Rio, au Texas, à la frontière mexicaine. À Las Vegas, tu es vite étourdi par les lumières. À Del Rio, au contraire, tout est calme : un petit motel, une station-service et le désert."],
  ['f-por-favor', "Au marché de Séville, j'ai appris trois mots : « hola », « gracias » et « por favor ». Tu es mal vu si tu oublies le « por favor » ! Le vendeur de jamón m'a souri quand je l'ai dit avec mon accent terrible. Toi qui es bilingue, tu rirais."],
  ['f-hospital-del-mar', "L'équipe de l'Hospital del Mar à Barcelone et celle de l'université de Los Angeles ont comparé deux protocoles. Les résultats, publiés en mars, montrent une baisse des réhospitalisations. Pour les auteurs, le suivi téléphonique est la clé."],
  ['f-itineraire', "Itinéraire : jour 1, Los Angeles ; jour 2, Las Vegas ; jour 3, Grand Canyon ; jour 4, retour par El Paso et Del Rio. Prévoir : chapeau, eau, crème solaire. Réservations faites. Tu es responsable des billets, moi de la voiture. Départ à 7 h !"],
  ['f-lakers', "Match nul ? Non : les Lakers de Los Angeles ont battu Las Vegas hier soir. Tu es fan de basket, toi ? Moi je suis plutôt foot. Mon cousin vit à El Paso, il suit tout, il m'envoie des vidéos à trois heures du matin. Tu n'es pas obligé de regarder."],
  ['f-biblio', "Références : Del Rio C, Malani PN. Bilan d'une épidémie. Presse Méd. 2021 ; 50 : 104-9. Los Arcos I, Con A. Hépatite auto-immune induite chez la souris. Gastroentérol Clin Biol. 2019 ; 43 : 12-8. Las Heras M, Del Pozo JL. Infections sur matériel. Rev Prat. 2020 ; 70 : 33-7."],
  ['b-roadtrip', "Tu es prêt ? Départ demain six heures : Los Angeles, Las Vegas, puis El Paso. Tu conduis jusqu'à Barstow, moi ensuite. T'es sûr pour l'essence ? Prends de l'eau, des chips et ta casquette. On dort au motel près de Del Rio samedi soir."]
]);

export const PROPER_EN = Object.freeze([
  ['e-el-nino-news', "Heavy rain from El Niño flooded parts of Los Angeles on Tuesday. The storm closed several roads in the San Fernando Valley, and officials in Las Vegas warned of flash floods. Forecasters expect the pattern to continue through February."],
  ['e-refs-delrio', "1. Del Rio C, Malani PN. Novel coronavirus: important information for clinicians. JAMA. 2020;323:1039-40. 2. Los Arcos I, Con A, Ruiz L. Lectin-induced hepatitis in mice. Hepatology. 2018;67:512-9. 3. Las Heras M, Del Pozo JL. Biofilm infections. N Engl J Med. 2017;376:1-3."],
  ['e-refs-conA', "References: Del Valle J, Del Rio C. Con A-induced liver injury: a model. J Hepatol. 2016;64:22-30. De Los Santos R. Con A and T cells. Immunity. 2015;43:1-9. Del Pozo JL, Las Casas F. Prosthetic joint infection. Lancet. 2014;383:5-12."],
  ['e-por-favor', "On our first morning in Madrid we learned two phrases: \"gracias\" and \"por favor.\" The waiter smiled when my son said \"por favor\" with a perfect accent. By the end of the week he was ordering churros for the whole family, and he still says it at home."],
  ['e-rio-grande', "The Rio Grande runs past Del Rio and Eagle Pass before reaching Laredo. In summer the river is low and slow; after a storm it can rise several feet in an hour. Local clinics in Del Rio see heat stroke every July, mostly in outdoor workers."],
  ['e-offices', "Our offices: Los Angeles (headquarters), Las Vegas, El Paso, Las Cruces, Del Mar and San Diego. Call the Los Angeles office for billing questions. Clinical questions go to the El Paso team. Hours are 8 a.m. to 6 p.m., Monday to Friday."],
  ['e-lupus-case', "A 34-year-old woman from Las Cruces presented with fever, joint pain and a malar rash. She had moved from El Paso two years earlier. Antinuclear antibodies were positive and complement levels were low, consistent with systemic lupus erythematosus."],
  ['e-conA-methods', "Methods: Mice received Con A (20 mg/kg) by tail vein injection. Serum ALT was measured at 8 h. Liver sections were stained with H&E. Con A-treated mice developed severe hepatitis; pretreatment with the antibody reduced ALT by 60%. Data are mean ± SD."],
  ['ref-hisp2', "1. Del Rio C, Malani PN. COVID-19: new insights on a rapidly changing epidemic. JAMA. 2020;323:1339-40. 2. Los Arcos I, Con A, Ruiz L. Lectin-induced hepatitis in mice. Hepatology. 2018;67:512-9."],
  ['ref-hisp3', "1. Del Rio C, Malani PN. COVID-19: new insights on a rapidly changing epidemic. JAMA. 2020;323:1339-40. 2. Los Arcos I, Con A, Ruiz L. Lectin-induced hepatitis in mice. Hepatology. 2018;67:512-9. 3. Las Heras M, Del Pozo JL. Biofilm infections. N Engl J Med. 2017;376:1-3."],
  ['ref-hisp6', "1. Del Rio C, Malani PN. COVID-19: new insights on a rapidly changing epidemic. JAMA. 2020;323:1339-40. 2. Los Arcos I, Con A, Ruiz L. Lectin-induced hepatitis in mice. Hepatology. 2018;67:512-9. 3. Las Heras M, Del Pozo JL. Biofilm infections. N Engl J Med. 2017;376:1-3. 4. De Los Santos R, Del Valle J. Con A and regulatory T cells. Immunity. 2015;43:1-9. 5. Del Pozo JL, Patel R. Infection associated with prosthetic joints. N Engl J Med. 2009;361:787-94. 6. Las Casas F, Del Mar G. Para-aortic lymph nodes in cervical cancer. Gynecol Oncol. 2012;125:1-6."]
]);

/** `[8n-e]` 문장 첫머리 대문자 es 기능어(`Los pacientes`·`El paciente`·`Del grupo`)에 기대는 스페인어 — 8n-e Build 가 지음.
 *  앞 셋은 소문자 es 기능어가 하나 이하라, 대문자 꼴을 세지 않으면 es 를 잃는다. 뒤 둘은 스페인어 고유명사(`Los Ángeles`·
 *  `El Niño`·`El Paso`)가 섞여도 es. 모두 es 여야 한다. */
export const ES_CAPS = Object.freeze([
  ['e-resultados', 'Los resultados llegaron ayer. Las cifras son buenas. Del grupo inicial, casi todos mejoraron. Con estos datos, seguimos igual. Una revisión más en junio y listo. Lo demás puede esperar hasta la próxima reunión de todo el equipo.'],
  ['e-guardia', 'El paciente tiene sesenta años. El dolor empezó anoche, después de cenar. Una hora más tarde vomitó dos veces. Las constantes son normales y la exploración no muestra nada raro. Lo prudente es esperar la analítica antes de decidir nada.'],
  ['e-agenda', 'Los lunes, consulta de tarde. Las primeras visitas, a las cuatro. Para urgencias, llamar a la centralita. Por favor, traigan la tarjeta sanitaria. Con receta antigua no se puede renovar nada. Del resto de dudas se encarga la secretaria.'],
  ['e-prima', 'Mi prima vive en Los Ángeles desde hace años. Los domingos llama a mi madre por teléfono. Las dos hablan de la familia, del tiempo y de la comida. Para ella, lo más difícil es estar lejos. Con todo, dice que es feliz allí y que no piensa volver.'],
  ['e-nino', 'El fenómeno de El Niño volverá este año. Los expertos esperan lluvias fuertes en la costa de Perú y sequía en Australia. Las autoridades de Los Ángeles y de El Paso ya preparan planes de emergencia. Por ahora, el mar sigue caliente.']
]);
