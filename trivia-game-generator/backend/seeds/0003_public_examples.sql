-- seed 0003: publish the 'Default' organization's example content in the Library (rules.md §2.8)
-- The example boards (seed 0002), the sample deck and its categories, so every organization
-- has something to copy. Runs once; does nothing if 'Default' or the examples don't exist.

UPDATE trivia_boards b SET visibility = 'public', published_at = now()
FROM trivia_organizations o
WHERE o.id = b.organization_id AND o.name = 'Default' AND b.visibility = 'private'
  AND b.name IN ('Linear Snake', 'Classic Loop', 'Forked Paths', 'Loop with Shortcut', 'Special Spaces Sandbox');

UPDATE trivia_decks d SET visibility = 'public', published_at = now()
FROM trivia_organizations o
WHERE o.id = d.organization_id AND o.name = 'Default' AND d.name = 'General Knowledge (sample)' AND d.visibility = 'private';

UPDATE trivia_categories c SET visibility = 'public', published_at = now()
FROM trivia_organizations o
WHERE o.id = c.organization_id AND o.name = 'Default' AND c.name IN ('Science', 'History', 'Art', 'Pop Culture') AND c.visibility = 'private';
