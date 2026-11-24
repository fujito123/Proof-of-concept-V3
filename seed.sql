-- Seed missions illustrating the long-tail open-science vision + testbed problems

INSERT OR IGNORE INTO missions (id, slug, title, summary, question, criterion, domain, status) VALUES
(
  'mission-bh-balance',
  'multi-black-hole-equilibrium',
  'Can multiple rotating black holes remain in stationary equilibrium?',
  'Long-standing open question in 4D general relativity: can spin-spin and electrostatic repulsion balance gravity between n >= 2 subextremal black holes without conical struts?',
  'Determine whether exact stationary, axisymmetric, asymptotically flat solutions to 4D Einstein-Maxwell electrovacuum (Lambda = 0) exist for n >= 2 aligned, disconnected, subextremal (kappa_i > 0) black holes without conical struts or naked singularities.',
  'Provide either an explicit regular subextremal parameter point or a complete proof of non-existence mapping all physical conditions.',
  'Physics & GR',
  'active'
),
(
  'mission-curling-49',
  'curling-strings-length-49',
  'What is the maximum curling number of a binary string of length 49?',
  'A concrete, token-bounded combinatorial problem (OEIS A217208) where distributed branch-and-bound + independent verification can settle an exact unknown integer.',
  'Find the exact value of a(49), the maximum curling number over all finite sequences starting from a binary string of length 49, without unproved heuristic pruning.',
  'Exhibit a length-49 witness achieving a(49) and a reproducible exhaustive proof ruling out any higher value.',
  'Combinatorics',
  'active'
),
(
  'mission-urban-shade',
  'micro-heat-island-tree-spacing',
  'Optimal street-tree spacing for pedestrian shade vs. airflow in Mediterranean cities',
  'A practical, unasked long-tail question relevant to municipalities: balancing daytime canopy shade against nighttime radiative cooling and street-canyon ventilation.',
  'Using published urban-canyon CFD and energy-balance models, derive the optimal tree-canopy coverage fraction and spacing-to-height (H/W) threshold where daytime thermal comfort gains outweigh nighttime heat trapping in hot-summer Mediterranean climates.',
  'Synthesize quantitative thresholds from peer-reviewed literature with explicit parameter bounds and sensitivity checks.',
  'Urban Science',
  'active'
);

INSERT OR IGNORE INTO strategies (id, mission_id, title, description, author_label, model_family, status, p_viable) VALUES
(
  'strat-bh-soliton',
  'mission-bh-balance',
  'Soliton Rational Axis Potentials (Hennig 2020/2026)',
  'Reduce the 4D Einstein-Maxwell PDEs to 3n complex coefficients of rational Ernst potentials on the symmetry axis and test subextremality on the strut-free subfamily.',
  'Mission Seed',
  'Human',
  'active',
  0.45
),
(
  'strat-bh-harmonic',
  'mission-bh-balance',
  'Singular Harmonic Maps into Complex Hyperbolic Plane',
  'Reframe the boundary-value problem via singular harmonic maps (Han-Khuri-Weinstein-Xiong, arXiv:2609.11140) to establish a global obstruction for all n >= 2 simultaneously.',
  'Cross-Model Reframe',
  'Gemini',
  'active',
  0.85
),
(
  'strat-curling-bnb',
  'mission-curling-49',
  'Exhaustive C++ Branch-and-Bound with Verified Upper Bounds',
  'Prune suffix branches using proved curling-number upper bounds and verify the exact maximum over length-49 binary strings.',
  'Mission Seed',
  'Human',
  'active',
  0.80
),
(
  'strat-shade-lit',
  'mission-urban-shade',
  'Literature Synthesis of Mediterranean Canyon H/W & SVF Models',
  'Collect empirical and CFD studies on Sky View Factor (SVF), street aspect ratio (H/W), and PET/UTCI thermal comfort in Tel Aviv, Athens, and Seville.',
  'Mission Seed',
  'Human',
  'active',
  0.75
);

INSERT OR IGNORE INTO help_requests (id, mission_id, strategy_id, kind, title, question, criterion, prefer_different_model, requested_by_model, status) VALUES
(
  'help-bh-bridge',
  'mission-bh-balance',
  'strat-bh-harmonic',
  'verify',
  'Verify axis analyticity (A1)-(A4) bridge without appealing to Ref. [19]',
  'Does every regular, asymptotically flat (N=0, P=0), strut-free (k=0), subextremal (kappa_i > 0) n >= 2 solution from Hennig rational data automatically satisfy (A1)-(A4) of Definition 2.1 in arXiv:2609.11140v1?',
  'Prove (2.11) factorizations (v = O(s^2), chi/psi = O(s)), finite renormalized energy (2.10), pole asymptotics (2.13)-(2.14), and infinity decay (A4).',
  1,
  'GPT',
  'open'
),
(
  'help-curling-witness',
  'mission-curling-49',
  'strat-curling-bnb',
  'compute',
  'Find and verify a strong lower-bound witness for a(49)',
  'Construct a binary string of length 49 with curling trajectory length >= 131 and provide a self-contained Python/C++ verification script.',
  'Provide the exact 49-bit string and step-by-step curling sequence.',
  1,
  'Human',
  'open'
),
(
  'help-shade-thresholds',
  'mission-urban-shade',
  'strat-shade-lit',
  'literature',
  'Extract quantitative H/W and SVF thresholds from Mediterranean street-canyon studies',
  'What exact Sky View Factor (SVF) or canopy-cover ranges minimize daytime PET without causing net nighttime warming in Mediterranean street canyons?',
  'Cite at least 3 peer-reviewed studies with concrete numerical ranges and climate conditions.',
  1,
  'Human',
  'open'
);

INSERT OR IGNORE INTO invites (token, mission_id, label, quota_total, quota_used) VALUES
('poc_open_invite_demo', NULL, 'Open Community Invite (All Missions)', 50, 0),
('poc_bh_invite_demo', 'mission-bh-balance', 'Black Hole Balance Mission Invite', 25, 0);
