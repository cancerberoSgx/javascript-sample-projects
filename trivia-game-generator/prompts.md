I want to build a trivia game generator (multiple users being asked by questions and a progress board.)

Before starting, I would like to document trivia-game rules (turns, board, rules, winning conditions, etc) in a separate file rules.md so I can reference this rules by following questions to you on implementation time.

These are some general rules that I'm targetting to. Can you transform this rules that is something more understandable for you ? 

The game will consist on N players, each one with their own turn on which: [Turn Start] ➔ [Roll Dice] ➔ [Update Position] ➔ [Draw Card] ➔ [Evaluate Answer] ➔ [Update Score/State] ➔ [Turn End]

Here is a comprehensive framework of rules for a card-and-dice trivia board game, engineered with strict logic patterns so you can directly copy-paste it into an LLM context window to generate your application code.
📜 Game System Specifications & Core Rules
1. Game Setup & Data Schema
• The Board (B): A finite linear array or closed-loop path containing N sequentially indexed spaces (\(0 \dots N-1\)). Each space is assigned a metadata attribute category (e.g., Science, History, Art, Pop Culture, Wildcard).
• The Cards (C): A collection of objects. Each card object contains:
	• id: Unique identifier.
	• category: String matching a board category.
	• question: String.
	• options: Array of strings [A, B, C, D] (for multiple choice) OR null (for open-ended).
	• correct_answer: String or Index mapping to the correct solution.
	• difficulty: Integer (1 = Easy, 2 = Medium, 3 = Hard).
• The Dice (D): A random number generator returning an integer between 1 and 6.
• Players (P): An ordered list of player profiles tracking:
	• id: Unique identifier.
	• current_space: Integer index on B (Initial state = 0).
	• inventory: Collection of earned badges/tokens per category.
	• score: Integer.
2. Main Game Loop (State Machine)
The application must evaluate states sequentially per turn:
[Turn Start] ➔ [Roll Dice] ➔ [Update Position] ➔ [Draw Card] ➔ [Evaluate Answer] ➔ [Update Score/State] ➔ [Turn End]
1. State: Roll Phase
	• Active player \(P_{x}\) triggers a dice roll event (R).
2. State: Movement Phase
	• Calculate new position: \(NewSpace = (CurrentSpace + R) \pmod N\) (if loop) or \(\min(CurrentSpace + R, N-1)\) (if linear track).
	• Set \(P_x.current_space = NewSpace\).
	• Retrieve \(Category = B[NewSpace].category\).
3. State: Trivia Phase
	• Draw top card from deck where Card.category == Category.
	• Present Card.question to \(P_{x}\) and initiate a countdown timer (e.g., 30 seconds).
4. State: Evaluation Phase
	• If \(P_x.input == Card.correct\_answer\) within the time limit:
		• Reward Logic: Increment \(P_x.score\) by Card.difficulty. If \(B[NewSpace]\) is a designated "Headquarters/Pie" space, append Category to \(P_x.inventory\).
		• Bonus Action: Grant an immediate extra roll (optional rule flag: bonus_roll_on_correct = true).
	• If \(P_x.input \neq Card.correct\_answer\) or timer expires:
		• Penalty Logic: Apply no reward. Turn ends immediately.
5. State: Next Turn Phase
	• Set \(ActivePlayer = (x + 1) \pmod{\text{TotalPlayers}}\).
3. Edge Cases & Special Spaces
• Roll Again Space: If \(B[NewSpace].type == 'roll_again'\), instantly re-trigger the Roll Phase without drawing a card.
• Shortcut Forking: If NewSpace intersects a decision node, prompt player for directional input before advancing.
• SAD/Penalty Space: Landing on a penalty space sets a state modifier P_x.skip_next_turn = true.
4. Win Conditions
The game engine continually monitors for two alternative terminating conditions:
• Condition A (Linear): First player to reach or exceed N-1 index AND correctly answer a final "Grand Prize" Wildcard question wins.
• Condition B (Set Collection): First player whose \(P_x.inventory\) contains at least one token from every distinct category on the board wins.



p2
ok, my objective is to now visualize (be able to play the turn myself) on any of the supported board configurations: linear, loop, forks, etc. 

Also IMPORTANT: this app won't be just a trivia game, but a trivia game generator. So I would like to see how each of the example boards are serialized and loaded from a json file.

Can you implement a frontend folder with a react app that allows me to select one board example and simulate myself how the movements work ? Don't have to have an image, only a canvas with some tiles / areas where I can move after the roll dice happens with validation. 

In the future this will evolve in the frontend of the app with a server and db , but for now just a frontend that loads same board json files with board definitions

do you have any question before proceeding ? 

p2

it looks ok, but one issue with forked paths board. When a fork starts, it seems you are missing one space in the count. In the current screenshot user has to move to one hightlighted space bnut the rolled was 2 and if I click a hightlighted space it errs with "Space 7 can't be reached with a roll of 2. Legal: 2.". see attached screenshot




# infra and basic model
ok boards look ok, now let's start building the foundation of this webapp before confining
implement a "backend" folder with the backend rest api using python and fastapi.
create a /docker/docker-compose file with a postgres db, the "backend" server and the frontend served for dev mode. I shoul dbe able to run /docker/docker-compose to bring the whole app up in a separate machine.
There should be a root .env file with some configurations, for now the db urls
regarding db: 
 * for all table names use the prefix "trivia_"
 * always use pure sql for repositories
 * support the concept of migrations (pure sql), create a first migration that contains the first tables and records
 * explain how to add new migrations and seed them in backend/readme.md
For now, just model the following concepts:
 * organization (name, openai_api_key)
 * user (belong to an organization) , name , email, password, user.role, for now can be "root" or "member"
 * root users can see all organizations and edit them. "member" users only see the concepts of their organization. A member user can only create/update  users in their organization
 * implement a CRUD for users and organizations. 
 * users can login/logout - use a json web token for session
In the frontend, leave the current "boards demo" in a separate tab accessible by root users. Then an "organizations" tab where they can crud organizations and their users.
do you have any question before proceeding ? 

p2
in repositories, let's type all concepts with pydantic or something else instead of using just dict

# more concepts

Now let's introduce more concepts (related to an organization)

 * game
   * status: running, not started, 
   * players - see below
   * creator: an organization user
   * board: see below
   * categories (see below)
   * deck ( see below)

 * player: game players doesn't have to be organization users. An organization member can create a new game and create N players each with their name
   * name

 * board
   * the current board concept except "categories", see below. board definition example: trivia-game-generator/frontend/public/boards/index.json

 * category
   * name
   * description

 * deck (a collection of questions and answers, each associated with a category) - see trivia-game-generator/frontend/public/decks/general.json
   * name
   * description
   * {category, question, answer} list

An organization user can create/edit categories, deck, boards and games 

do you have any questions before proceeding ? 


# claude.md
initialize trivia-game-generator/CLAUDE.md with the results of this conversations and this firsts prompts we've implemented relevant to future work with you implementing more features.

# impersonate
root users are able to impersonate a member user of any organization, in which case they see exactly the same experience as this member. When impersonating there must be a top-banner saying that with the option to "exit" impersonate experience. The objective is that root users can test any member user experience without having to logout / login

# routes
in the frontend, each main tab games, boards, categories, boards, decks, organizations, etc must have a browser url address (route) like /organizations/1, /boards/1, games/1, etc

# game experience

there's a /games/1234/play page which displays the game play experience, right now leave it the same as the current "boards demo" experience where user given a board and deck can roll dice and switch user's turn. In the games/3 route (game details) a member can participate in the current game as one of the players for testing it.
Also we want to save a game state (current user's space, scores, tokens, logs, etc). Member is able to save / load games. use a db table games_instances to store/load games. The objective is that a game can be interrupted to day, saved and load it by the member in the future to continue it 


# multiplayer game experience

the creator of a game, can create a game without players
the creator then can share a game like foo.com/games/123?code=12345 and if other players open the link in their own devices, the the app ask them for their name and if they want to enter (game's player names must be unique)
when player confirms, the player is automatically created
new players can only be created when the game status is "awaiting"
member user can "start the game" when they want, if there are more than zero players. 
the /game/123 screen must use websockets or polling so each player has a "real time" game experience, seeing when others roll dices, move and them selves. I'd prefer websockets if possible

Before implementing this multiplayer game play in both frontend and backend analyze the problem and ask any question you'd have.



# board editor
currently the only way of editing board spaces and directions (graph) is by editing json. Instead users must be able to edit the board graph visually. 
users must be able to:
 * define all slots A, B, C, D or whatever names they want
 * create new nodes bu clicking on a space
 * select one node which display a "Halo" with actions: delete node, create arrow / edge, create fork, edit slot name
 * define which is the start and finish node.
Can you think on anything else users might need to completly define a custom board ? Can you also think if we need to change the current validation so it's more visible / understandable?


# FUTURE


# generate deck with openai or gemini
organization members can also set up a gemini apikey besides the openai apikey so they can use both
in decks -> new deck, currently users must manually create each card which is fine. But also we want users are able to generate N cards using openai or gemini defining:
 * how many cards in total
 * which categories to use and optionally the ratio of each category, for example, 20% of science category and 80% of history category
 * the card generator never generates repeated questions (both in the generated set and in the current deck cards.)
 * difficulty (and also with ratios, for example, 50% easy, 50% hard)
 * question type ratio, multiple select ratio vs open answer
Before implementing this, would you say it's viable to generate 100 cards in a single openai or gemini call, or should we somehow do it in batches. 
Note: I've left apikeys available for you to test in .env OPENAI_API_KEY, GEMINI_API_KEY but remember that each organization must to set up them. Both keys in the organization are optional. If there are no apikeys then the user cannot generate. If bnoth apikeys are set, then the user must pick one LLM
Do you think it's possible? Do you have any question before implementing this ? 

p2
make sure the categories descriptions are given to the llm for more context, because we could have a category called history-uruguay and history-argentina and their semantics should be defined in their descriptions. 
Also add the openai and gemini models in the organization record, let the user configure them optionally, by default use gpt-5.4-mini and gemini-3.5-flash,
do you have any doubts about these two things?

# categories metadata
currently, categories consists on a name and a description. Nevertheless, we could have similar categories or subcategories, such as "history", "history-world", "history-uruguay", each with different descriptions so the LLM has more context when creating cards. Nevertheless, categories must also have a label, which is displayed in a game, since we don't want to display long names such as history-uruguay or geography-uruguay but just "history" and "geography" in a game that which every card is related to uruguay. Do you understand or have any question befor implementing this ? 
