// Enlace entre los ejercicios que ya tenías y el catálogo de 1.324.
//
// Vive en su propio archivo porque lo necesitan dos sitios que no se pueden
// importar entre sí: media.js (para las imágenes) y model.js (para el grupo
// muscular al migrar). Si lo exportara media.js habría un ciclo.

export const ENLACE_INICIAL = {
  "Press plano": { catalogId: '0289', media: 'SpYC0Kp', grupo: 'Pecho', en: "dumbbell bench press" },
  "Jalón prono": { catalogId: '0198', media: 'RVwzP10', grupo: 'Espalda', en: "cable pulldown" },
  "Press militar": { catalogId: '0603', media: '67n3r98', grupo: 'Hombro', en: "lever shoulder press" },
  "Curl bíceps": { catalogId: '0294', media: 'NbVPDMW', grupo: 'Bíceps', en: "dumbbell biceps curl" },
  "Ext. tríceps": { catalogId: '0201', media: '3ZflifB', grupo: 'Tríceps', en: "cable pushdown" },
  "Press inclinado máquina": { catalogId: '1299', media: 'jHAnWmT', grupo: 'Pecho', en: "lever incline chest press" },
  "Remo unilateral": { catalogId: '0589', media: 'Fhdtwf3', grupo: 'Espalda', en: "lever one arm bent over row" },
  "Deltoides posterior": { catalogId: '0602', media: 'myfUsKf', grupo: 'Hombro', en: "lever seated reverse fly" },
  "Ext. tríceps overhead": { catalogId: '0092', media: '5uFK1xr', grupo: 'Tríceps', en: "barbell seated overhead triceps extension" },
  "Curl martillo": { catalogId: '0313', media: 'slDvUAU', grupo: 'Bíceps', en: "dumbbell hammer curl" },
  "Prensa": { catalogId: '1425', media: 'WWD6FzI', grupo: 'Glúteo', en: "sled 45 degrees one leg press" },
  "Curl femoral": { catalogId: '0586', media: '17lJ1kr', grupo: 'Femoral', en: "lever lying leg curl" },
  "Hip thrust": { catalogId: '3236', media: 'Pjbc0Kt', grupo: 'Glúteo', en: "resistance band hip thrusts on knees (female)" },
  "Abductores": { catalogId: '0597', media: 'CHpahtl', grupo: 'Glúteo', en: "lever seated hip abduction" },
  "Piernas rígidas / SLDL": { catalogId: '0432', media: '5eLRITT', grupo: 'Glúteo', en: "dumbbell stiff leg deadlift" },
  "Leg extension": { catalogId: '0585', media: 'my33uHU', grupo: 'Cuádriceps', en: "lever leg extension" },
  "Sissy squat": { catalogId: '1489', media: 'xdYPUtE', grupo: 'Cuádriceps', en: "sissy squat" },
  "Abs": { catalogId: '0175', media: 'WW95auq', grupo: 'Abdomen', en: "cable kneeling crunch" },
  "Elevación lateral": { catalogId: '0178', media: 'goJ6ezq', grupo: 'Hombro', en: "cable lateral raise" },
  "Curl bíceps 90°": { catalogId: '0195', media: 'P2lNrGL', grupo: 'Bíceps', en: "cable preacher curl" },
  "Sentadilla": { catalogId: '0043', media: 'qXTaZnJ', grupo: 'Glúteo', en: "barbell full squat" },
  "Press around": { catalogId: '1262', media: 'w4dLzSx', grupo: 'Pecho', en: "cable one arm decline chest fly" },
  "Zancada": { catalogId: '0054', media: 't8iSghb', grupo: 'Glúteo', en: "barbell lunge" },
};
