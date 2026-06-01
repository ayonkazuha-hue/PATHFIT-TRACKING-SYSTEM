const defaultRubrics = {
  push_ups: {
    male: [[30, 'excellent'], [20, 'very_good'], [10, 'good'], [5, 'fair'], [1, 'needs_improvement'], [0, 'poor']],
    female: [[20, 'excellent'], [15, 'very_good'], [10, 'good'], [5, 'fair'], [1, 'needs_improvement'], [0, 'poor']]
  },
  sit_reach: { 
    male: [[61, 'excellent'], [46, 'very_good'], [31, 'good'], [16, 'fair'], [5, 'needs_improvement'], [0, 'poor']], 
    female: [[61, 'excellent'], [46, 'very_good'], [31, 'good'], [16, 'fair'], [5, 'needs_improvement'], [0, 'poor']] 
  },
  zipper_test: { 
    male: [[6, 'excellent'], [4, 'very_good'], [2, 'good'], [0.1, 'fair'], [0, 'needs_improvement'], [-9999, 'poor']], 
    female: [[6, 'excellent'], [4, 'very_good'], [2, 'good'], [0.1, 'fair'], [0, 'needs_improvement'], [-9999, 'poor']] 
  },
  juggling: { 
    male: [[41, 'excellent'], [31, 'very_good'], [21, 'good'], [11, 'fair'], [1, 'needs_improvement'], [0, 'poor']], 
    female: [[41, 'excellent'], [31, 'very_good'], [21, 'good'], [11, 'fair'], [1, 'needs_improvement'], [0, 'poor']] 
  },
  sprint_40m: { 
    male: [[0, 'excellent'], [4.1, 'very_good'], [5.5, 'good'], [6.6, 'fair'], [7.6, 'needs_improvement']], 
    female: [[0, 'excellent'], [4.6, 'very_good'], [6.0, 'good'], [7.1, 'fair'], [8.2, 'needs_improvement']] 
  },
  stork_balance: { 
    male: [[161, 'excellent'], [121, 'very_good'], [81, 'good'], [41, 'fair'], [21, 'needs_improvement'], [0, 'poor']], 
    female: [[161, 'excellent'], [121, 'very_good'], [81, 'good'], [41, 'fair'], [21, 'needs_improvement'], [0, 'poor']] 
  },
  stick_drop: { 
    male: [[0, 'excellent'], [5.8, 'very_good'], [12.7, 'good'], [20.32, 'fair'], [27.94, 'needs_improvement'], [30.49, 'poor']], 
    female: [[0, 'excellent'], [5.8, 'very_good'], [12.7, 'good'], [20.32, 'fair'], [27.94, 'needs_improvement'], [30.49, 'poor']] 
  },
  agility_test: { 
    male: [[0, 'excellent'], [5.01, 'very_good'], [10.01, 'good'], [15.01, 'fair'], [20.01, 'needs_improvement'], [25.01, 'poor']], 
    female: [[0, 'excellent'], [5.01, 'very_good'], [10.01, 'good'], [15.01, 'fair'], [20.01, 'needs_improvement'], [25.01, 'poor']] 
  },
  step_test_3min: {
    female: {
      '18-25': [[0, 'excellent'], [81.01, 'very_good'], [102.01, 'good'], [110.01, 'fair'], [120.01, 'needs_improvement'], [169.01, 'poor']],
      '26-35': [[0, 'excellent'], [80.01, 'very_good'], [101.01, 'good'], [110.01, 'fair'], [119.01, 'needs_improvement'], [171.01, 'poor']],
      '36+': [[0, 'excellent'], [84.01, 'very_good'], [104.01, 'good'], [112.01, 'fair'], [120.01, 'needs_improvement'], [169.01, 'poor']]
    },
    male: {
      '18-25': [[0, 'excellent'], [76.01, 'very_good'], [93.01, 'good'], [100.01, 'fair'], [107.01, 'needs_improvement'], [157.01, 'poor']],
      '26-35': [[0, 'excellent'], [67.01, 'very_good'], [94.01, 'good'], [102.01, 'fair'], [110.01, 'needs_improvement'], [161.01, 'poor']],
      '36+': [[0, 'excellent'], [76.01, 'very_good'], [88.01, 'good'], [105.01, 'fair'], [133.01, 'needs_improvement'], [163.01, 'poor']]
    }
  }
};

let currentRubrics = null;

async function init(supabaseAdmin) {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'fitness_rubrics')
      .single();
      
    if (data && data.value) {
      currentRubrics = data.value;
    } else {
      currentRubrics = defaultRubrics;
    }
  } catch (err) {
    console.error("Could not fetch fitness rubrics, using defaults:", err.message);
    currentRubrics = defaultRubrics;
  }
}

function get() {
  return currentRubrics || defaultRubrics;
}

async function set(supabaseAdmin, newRubrics) {
  currentRubrics = newRubrics;
  try {
    await supabaseAdmin
      .from('system_settings')
      .upsert({ key: 'fitness_rubrics', value: newRubrics });
  } catch(err) {
    console.error("Failed to persist fitness rubrics:", err.message);
  }
}

function getRating(testType, gender, age, value) {
  const v = parseFloat(value);
  const rubrics = get();
  
  if (testType === 'step_test_3min') {
    const studentAge = age || 18;
    let ageGroup = '18-25';
    if (studentAge >= 26 && studentAge <= 35) ageGroup = '26-35';
    else if (studentAge >= 36) ageGroup = '36+';
    
    const table = rubrics[testType]?.[gender]?.[ageGroup];
    if (!table) return 'poor';
    
    for (const [threshold, rating] of [...table].reverse()) {
      if (v >= threshold) return rating;
    }
    return 'excellent';
  }

  const table = rubrics[testType]?.[gender];
  if (!table) return 'fair';
  
  if (['sprint_40m', 'stick_drop', 'agility_test'].includes(testType)) {
    if (testType === 'sprint_40m' && v <= 0) return 'poor';
    for (const [threshold, rating] of [...table].reverse()) {
      if (v >= threshold) return rating;
    }
    return 'excellent';
  }
  
  for (const [threshold, rating] of table) {
    if (v >= threshold) return rating;
  }
  return 'poor';
}

module.exports = {
  init,
  get,
  set,
  getRating,
  defaultRubrics
};
