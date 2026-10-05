-- seed 0002: example categories, deck, boards and a game for the 'Default' organization
-- Generated from frontend/public/boards/*.json and frontend/public/decks/general.json.
-- Safe to re-run: rows that already exist (same name) are skipped. Does nothing if 'Default' doesn't exist.

-- Categories
INSERT INTO trivia_categories (organization_id, name, description, color)
SELECT o.id, v.name, v.description, v.color
FROM trivia_organizations o, (VALUES
    ('Science', 'Physics, chemistry, biology and astronomy.', '#3b82f6'),
    ('History', 'Events, empires and people from the past.', '#d97706'),
    ('Art', 'Painting, sculpture, music and literature.', '#db2777'),
    ('Pop Culture', 'Movies, TV, music and games.', '#16a34a')
) AS v (name, description, color)
WHERE o.name = 'Default'
ON CONFLICT DO NOTHING;

-- Deck + cards (cards are only added when the deck is new)
WITH org AS (SELECT id FROM trivia_organizations WHERE name = 'Default'),
deck AS (
    INSERT INTO trivia_decks (organization_id, name, description)
    SELECT id, 'General Knowledge (sample)', 'A small mixed deck to try the boards with.' FROM org
    ON CONFLICT DO NOTHING
    RETURNING id, organization_id
)
INSERT INTO trivia_cards (deck_id, category_id, question, options, answer, difficulty, grand_prize, position)
SELECT deck.id, c.id, v.question, v.options, v.answer, v.difficulty, v.grand_prize, v.position
FROM deck
CROSS JOIN (VALUES
    ('Science', 'What is the chemical symbol for gold?', '["Ag","Au","Gd","Go"]'::jsonb, 'Au', 1, false, 0),
    ('Science', 'Which planet is known as the Red Planet?', '["Venus","Jupiter","Mars","Mercury"]'::jsonb, 'Mars', 1, false, 1),
    ('Science', 'What gas do plants absorb from the air for photosynthesis?', NULL, 'carbon dioxide', 1, false, 2),
    ('Science', 'How many bones are in the adult human body?', '["186","206","226","256"]'::jsonb, '206', 2, false, 3),
    ('Science', 'What is the most abundant gas in Earth''s atmosphere?', NULL, 'nitrogen', 2, false, 4),
    ('Science', 'What is the charge of a strange quark, in elementary charge units?', '["+2/3","-1/3","+1/3","-2/3"]'::jsonb, '-1/3', 3, false, 5),
    ('History', 'In which year did World War II end?', '["1943","1944","1945","1946"]'::jsonb, '1945', 1, false, 6),
    ('History', 'Who was the first President of the United States?', NULL, 'George Washington', 1, false, 7),
    ('History', 'Which ancient civilization built Machu Picchu?', '["Aztec","Maya","Inca","Olmec"]'::jsonb, 'Inca', 2, false, 8),
    ('History', 'Which empire was ruled by Suleiman the Magnificent?', '["Ottoman","Persian","Mughal","Byzantine"]'::jsonb, 'Ottoman', 2, false, 9),
    ('History', 'In which city was the Treaty of Versailles signed?', NULL, 'Versailles', 2, false, 10),
    ('History', 'Which battle ended Napoleon''s rule in 1815?', '["Austerlitz","Leipzig","Trafalgar","Waterloo"]'::jsonb, 'Waterloo', 3, false, 11),
    ('Art', 'Who painted the Mona Lisa?', '["Michelangelo","Leonardo da Vinci","Raphael","Donatello"]'::jsonb, 'Leonardo da Vinci', 1, false, 12),
    ('Art', 'Which artist cut off part of his own ear?', NULL, 'Van Gogh', 1, false, 13),
    ('Art', 'Which art movement is Salvador Dalí associated with?', '["Cubism","Impressionism","Surrealism","Fauvism"]'::jsonb, 'Surrealism', 2, false, 14),
    ('Art', 'In which city is the Prado Museum?', NULL, 'Madrid', 2, false, 15),
    ('Art', 'Who sculpted ''The Thinker''?', '["Rodin","Bernini","Canova","Brâncuși"]'::jsonb, 'Rodin', 2, false, 16),
    ('Art', 'Which Dutch painter created ''Girl with a Pearl Earring''?', '["Rembrandt","Vermeer","Hals","Steen"]'::jsonb, 'Vermeer', 3, false, 17),
    ('Pop Culture', 'Which band released the album ''Abbey Road''?', '["The Rolling Stones","The Beatles","Queen","The Who"]'::jsonb, 'The Beatles', 1, false, 18),
    ('Pop Culture', 'What is the name of the wizarding school in Harry Potter?', NULL, 'Hogwarts', 1, false, 19),
    ('Pop Culture', 'Which video game features a plumber named Mario?', '["Sonic","Zelda","Super Mario Bros.","Metroid"]'::jsonb, 'Super Mario Bros.', 1, false, 20),
    ('Pop Culture', 'Which film won the first-ever Academy Award for Best Picture?', '["Wings","Sunrise","Metropolis","The Jazz Singer"]'::jsonb, 'Wings', 3, false, 21),
    ('Pop Culture', 'Which TV series features the city of Springfield and the Simpson family?', NULL, 'The Simpsons', 1, false, 22),
    ('Pop Culture', 'What year was the first iPhone released?', '["2005","2006","2007","2008"]'::jsonb, '2007', 2, false, 23),
    ('Science', 'What is the speed of light in a vacuum, in km/s (rounded to the nearest thousand)?', '["150,000","300,000","450,000","1,000,000"]'::jsonb, '300,000', 3, true, 24),
    ('Art', 'Which composer wrote ''The Rite of Spring''?', NULL, 'Stravinsky', 3, true, 25),
    ('Science', 'Which element has atomic number 79?', '["Platinum","Mercury","Gold","Lead"]'::jsonb, 'Gold', 3, true, 26),
    ('History', 'In which year did the Berlin Wall fall?', '["1987","1988","1989","1990"]'::jsonb, '1989', 3, true, 27)
) AS v (category, question, options, answer, difficulty, grand_prize, position)
JOIN trivia_categories c ON c.organization_id = deck.organization_id AND c.name = v.category;

-- Boards (definition = config + slots + spaces)
INSERT INTO trivia_boards (organization_id, name, description, definition)
SELECT o.id, v.name, v.description, v.definition
FROM trivia_organizations o, (VALUES
    ('Linear Snake', '20 spaces in a straight line laid out as a snake. Win by reaching the finish and answering the Grand Prize, or by collecting all 4 HQ tokens.', '{"config":{"track_type":"linear","win_conditions":["finish","collection"]},"slots":["A","B","C","D"],"spaces":[{"index":0,"type":"start","slot":null,"next":[1],"pos":{"x":0,"y":0}},{"index":1,"type":"category","slot":"A","next":[2],"pos":{"x":1,"y":0}},{"index":2,"type":"category","slot":"B","next":[3],"pos":{"x":2,"y":0}},{"index":3,"type":"hq","slot":"A","next":[4],"pos":{"x":3,"y":0}},{"index":4,"type":"category","slot":"C","next":[5],"pos":{"x":4,"y":0}},{"index":5,"type":"roll_again","slot":null,"next":[6],"pos":{"x":4,"y":1}},{"index":6,"type":"category","slot":"D","next":[7],"pos":{"x":3,"y":1}},{"index":7,"type":"hq","slot":"B","next":[8],"pos":{"x":2,"y":1}},{"index":8,"type":"category","slot":"A","next":[9],"pos":{"x":1,"y":1}},{"index":9,"type":"category","slot":"B","next":[10],"pos":{"x":0,"y":1}},{"index":10,"type":"penalty","slot":null,"next":[11],"pos":{"x":0,"y":2}},{"index":11,"type":"category","slot":"C","next":[12],"pos":{"x":1,"y":2}},{"index":12,"type":"hq","slot":"C","next":[13],"pos":{"x":2,"y":2}},{"index":13,"type":"category","slot":"D","next":[14],"pos":{"x":3,"y":2}},{"index":14,"type":"wildcard","slot":null,"next":[15],"pos":{"x":4,"y":2}},{"index":15,"type":"category","slot":"A","next":[16],"pos":{"x":4,"y":3}},{"index":16,"type":"hq","slot":"D","next":[17],"pos":{"x":3,"y":3}},{"index":17,"type":"category","slot":"B","next":[18],"pos":{"x":2,"y":3}},{"index":18,"type":"category","slot":"C","next":[19],"pos":{"x":1,"y":3}},{"index":19,"type":"finish","slot":null,"next":[],"pos":{"x":0,"y":3}}]}'::jsonb),
    ('Classic Loop', '24 spaces in a closed loop. There is no finish: win by collecting all 4 HQ tokens, or have the best score after 12 rounds.', '{"config":{"track_type":"loop","win_conditions":["collection","turn_limit"],"max_rounds":12},"slots":["A","B","C","D"],"spaces":[{"index":0,"type":"start","slot":null,"next":[1],"pos":{"x":0,"y":0}},{"index":1,"type":"category","slot":"A","next":[2],"pos":{"x":1,"y":0}},{"index":2,"type":"category","slot":"B","next":[3],"pos":{"x":2,"y":0}},{"index":3,"type":"hq","slot":"A","next":[4],"pos":{"x":3,"y":0}},{"index":4,"type":"category","slot":"C","next":[5],"pos":{"x":4,"y":0}},{"index":5,"type":"category","slot":"D","next":[6],"pos":{"x":5,"y":0}},{"index":6,"type":"roll_again","slot":null,"next":[7],"pos":{"x":6,"y":0}},{"index":7,"type":"category","slot":"A","next":[8],"pos":{"x":6,"y":1}},{"index":8,"type":"category","slot":"B","next":[9],"pos":{"x":6,"y":2}},{"index":9,"type":"hq","slot":"B","next":[10],"pos":{"x":6,"y":3}},{"index":10,"type":"category","slot":"C","next":[11],"pos":{"x":6,"y":4}},{"index":11,"type":"category","slot":"D","next":[12],"pos":{"x":6,"y":5}},{"index":12,"type":"wildcard","slot":null,"next":[13],"pos":{"x":6,"y":6}},{"index":13,"type":"category","slot":"A","next":[14],"pos":{"x":5,"y":6}},{"index":14,"type":"category","slot":"B","next":[15],"pos":{"x":4,"y":6}},{"index":15,"type":"hq","slot":"C","next":[16],"pos":{"x":3,"y":6}},{"index":16,"type":"category","slot":"C","next":[17],"pos":{"x":2,"y":6}},{"index":17,"type":"category","slot":"D","next":[18],"pos":{"x":1,"y":6}},{"index":18,"type":"penalty","slot":null,"next":[19],"pos":{"x":0,"y":6}},{"index":19,"type":"category","slot":"A","next":[20],"pos":{"x":0,"y":5}},{"index":20,"type":"category","slot":"B","next":[21],"pos":{"x":0,"y":4}},{"index":21,"type":"hq","slot":"D","next":[22],"pos":{"x":0,"y":3}},{"index":22,"type":"category","slot":"C","next":[23],"pos":{"x":0,"y":2}},{"index":23,"type":"category","slot":"D","next":[0],"pos":{"x":0,"y":1}}]}'::jsonb),
    ('Forked Paths', 'A linear track with two forks. Fork 1: a short branch with a penalty, or a longer one with a roll-again. Fork 2: a direct penalty path, or a scenic detour past two HQs.', '{"config":{"track_type":"linear","win_conditions":["finish","collection"]},"slots":["A","B","C","D"],"spaces":[{"index":0,"type":"start","slot":null,"next":[1],"pos":{"x":0,"y":2}},{"index":1,"type":"category","slot":"A","next":[2],"pos":{"x":1,"y":2}},{"index":2,"type":"category","slot":"B","next":[3],"pos":{"x":2,"y":2}},{"index":3,"type":"category","slot":"C","next":[4,6],"pos":{"x":3,"y":2}},{"index":4,"type":"penalty","slot":null,"next":[5],"pos":{"x":4,"y":1}},{"index":5,"type":"hq","slot":"A","next":[11],"pos":{"x":5,"y":1}},{"index":6,"type":"category","slot":"D","next":[7],"pos":{"x":3,"y":3}},{"index":7,"type":"hq","slot":"B","next":[8],"pos":{"x":3,"y":4}},{"index":8,"type":"category","slot":"A","next":[9],"pos":{"x":4,"y":4}},{"index":9,"type":"roll_again","slot":null,"next":[10],"pos":{"x":5,"y":4}},{"index":10,"type":"category","slot":"B","next":[11],"pos":{"x":6,"y":3}},{"index":11,"type":"category","slot":"C","next":[12],"pos":{"x":6,"y":2}},{"index":12,"type":"wildcard","slot":null,"next":[13],"pos":{"x":7,"y":2}},{"index":13,"type":"category","slot":"D","next":[14,19],"pos":{"x":8,"y":2}},{"index":14,"type":"category","slot":"A","next":[15],"pos":{"x":8,"y":1}},{"index":15,"type":"hq","slot":"C","next":[16],"pos":{"x":8,"y":0}},{"index":16,"type":"category","slot":"B","next":[17],"pos":{"x":9,"y":0}},{"index":17,"type":"hq","slot":"D","next":[18],"pos":{"x":10,"y":0}},{"index":18,"type":"category","slot":"C","next":[20],"pos":{"x":10,"y":1}},{"index":19,"type":"penalty","slot":null,"next":[20],"pos":{"x":9,"y":2}},{"index":20,"type":"category","slot":"D","next":[21],"pos":{"x":10,"y":2}},{"index":21,"type":"category","slot":"A","next":[22],"pos":{"x":11,"y":2}},{"index":22,"type":"finish","slot":null,"next":[],"pos":{"x":12,"y":2}}]}'::jsonb),
    ('Loop with Shortcut', 'A 20-space loop with a 4-space shortcut down the middle. The shortcut has the only Pop Culture HQ and a penalty. Collect all tokens, or have the best score after 10 rounds.', '{"config":{"track_type":"loop","win_conditions":["collection","turn_limit"],"max_rounds":10},"slots":["A","B","C","D"],"spaces":[{"index":0,"type":"start","slot":null,"next":[1],"pos":{"x":0,"y":0}},{"index":1,"type":"category","slot":"A","next":[2],"pos":{"x":1,"y":0}},{"index":2,"type":"category","slot":"B","next":[3,20],"pos":{"x":2,"y":0}},{"index":3,"type":"category","slot":"C","next":[4],"pos":{"x":3,"y":0}},{"index":4,"type":"category","slot":"D","next":[5],"pos":{"x":4,"y":0}},{"index":5,"type":"hq","slot":"A","next":[6],"pos":{"x":5,"y":0}},{"index":6,"type":"category","slot":"A","next":[7],"pos":{"x":5,"y":1}},{"index":7,"type":"category","slot":"B","next":[8],"pos":{"x":5,"y":2}},{"index":8,"type":"roll_again","slot":null,"next":[9],"pos":{"x":5,"y":3}},{"index":9,"type":"category","slot":"C","next":[10],"pos":{"x":5,"y":4}},{"index":10,"type":"hq","slot":"B","next":[11],"pos":{"x":5,"y":5}},{"index":11,"type":"category","slot":"D","next":[12],"pos":{"x":4,"y":5}},{"index":12,"type":"category","slot":"A","next":[13],"pos":{"x":3,"y":5}},{"index":13,"type":"category","slot":"B","next":[14],"pos":{"x":2,"y":5}},{"index":14,"type":"category","slot":"C","next":[15],"pos":{"x":1,"y":5}},{"index":15,"type":"hq","slot":"C","next":[16],"pos":{"x":0,"y":5}},{"index":16,"type":"category","slot":"D","next":[17],"pos":{"x":0,"y":4}},{"index":17,"type":"wildcard","slot":null,"next":[18],"pos":{"x":0,"y":3}},{"index":18,"type":"category","slot":"A","next":[19],"pos":{"x":0,"y":2}},{"index":19,"type":"category","slot":"B","next":[0],"pos":{"x":0,"y":1}},{"index":20,"type":"category","slot":"C","next":[21],"pos":{"x":2,"y":1}},{"index":21,"type":"penalty","slot":null,"next":[22],"pos":{"x":2,"y":2}},{"index":22,"type":"hq","slot":"D","next":[23],"pos":{"x":2,"y":3}},{"index":23,"type":"category","slot":"D","next":[13],"pos":{"x":2,"y":4}}]}'::jsonb),
    ('Special Spaces Sandbox', 'A short track full of special spaces, played with a 4-sided die and a 15 s timer. Good for testing roll-again caps, penalty skips and wildcard choices.', '{"config":{"track_type":"linear","dice_sides":4,"answer_time_limit_sec":15,"max_rolls_per_turn":3,"win_conditions":["finish"]},"slots":["A","B","C","D"],"spaces":[{"index":0,"type":"start","slot":null,"next":[1],"pos":{"x":0,"y":0}},{"index":1,"type":"roll_again","slot":null,"next":[2],"pos":{"x":1,"y":0}},{"index":2,"type":"penalty","slot":null,"next":[3],"pos":{"x":2,"y":0}},{"index":3,"type":"wildcard","slot":null,"next":[4],"pos":{"x":3,"y":0}},{"index":4,"type":"roll_again","slot":null,"next":[5],"pos":{"x":4,"y":0}},{"index":5,"type":"hq","slot":"A","next":[6],"pos":{"x":5,"y":0}},{"index":6,"type":"penalty","slot":null,"next":[7],"pos":{"x":5,"y":1}},{"index":7,"type":"wildcard","slot":null,"next":[8],"pos":{"x":4,"y":1}},{"index":8,"type":"roll_again","slot":null,"next":[9],"pos":{"x":3,"y":1}},{"index":9,"type":"category","slot":"B","next":[10],"pos":{"x":2,"y":1}},{"index":10,"type":"penalty","slot":null,"next":[11],"pos":{"x":1,"y":1}},{"index":11,"type":"finish","slot":null,"next":[],"pos":{"x":0,"y":1}}]}'::jsonb)
) AS v (name, description, definition)
WHERE o.name = 'Default'
ON CONFLICT DO NOTHING;

-- A game ready to start: Forked Paths + the sample deck, slots A-D = the four categories
WITH org AS (SELECT id FROM trivia_organizations WHERE name = 'Default'),
game AS (
    INSERT INTO trivia_games (organization_id, name, creator_id, board_id, deck_id)
    SELECT org.id, 'Friday Quiz Night',
           (SELECT id FROM trivia_users WHERE organization_id = org.id AND role = 'root' ORDER BY id LIMIT 1),
           (SELECT id FROM trivia_boards WHERE organization_id = org.id AND name = 'Forked Paths'),
           (SELECT id FROM trivia_decks WHERE organization_id = org.id AND name = 'General Knowledge (sample)')
    FROM org
    WHERE NOT EXISTS (SELECT 1 FROM trivia_games g WHERE g.organization_id = org.id AND g.name = 'Friday Quiz Night')
    RETURNING id, organization_id
),
mapping AS (
    INSERT INTO trivia_game_categories (game_id, slot, category_id)
    SELECT game.id, v.slot, c.id
    FROM game
    CROSS JOIN (VALUES ('A', 'Science'), ('B', 'History'), ('C', 'Art'), ('D', 'Pop Culture')) AS v (slot, category)
    JOIN trivia_categories c ON c.organization_id = game.organization_id AND c.name = v.category
)
INSERT INTO trivia_players (game_id, name, position)
SELECT game.id, v.name, v.position FROM game
CROSS JOIN (VALUES ('Ana', 0), ('Ben', 1), ('Cleo', 2)) AS v (name, position);
