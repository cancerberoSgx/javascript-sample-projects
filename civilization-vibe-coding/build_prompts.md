## initial prompt:

implement a civilization like game. Model it so it's easy to change units, technologies, ground/map easily to create custom games.

I need the implementation to be written on react.js + typescript + a suitable app-state library like redux or one of your suggestiosn for this user case. 

On performance side, focus on a performant turn-based map of big N-M like 2000x1600 . Implement the map as a html elements table (squared). If multiple items are in the smae square (like terrain, city, unit), just draw then on top iof each other


## zoom
add zoom-in and zoom-out functionality


## tile refinement

On each tile of the map we paint the following. 
On the background we paint the terrain, on top of the terrain we paint the accidents, on top of the accidents we paint the resources and on top of resources we paint cities and units. 
Terrains: plains, grassland, desert, tundra, snow, ocean
Accidents: hill, mountain, swamp, forrest, jungle, river, cost, 
Resources: Wheat, Rice, Corn, Cattle, Sheep, Deer, Fish, Bananas, Crabs
UNits: warrior, archer, pikeman, worker, settler


Task 1: model all of this with typescript and be generic enough so it's easy to add new terrains, accidents, resources, units, etc

Task 2: the map generation function, now on each tile will combine: Terrains always, accidents: 50% of the time, resources: 10% of the time, cities: 2% of the time, units: 5% of the time

Task 3: when drawing the tile, represent terrains with colors (that make sense for the terrain), accidents with a letter at the top-left of the tile, resources with a letteR at the top-right of the tile, units with a letteR at the bottom-left adn city with a letter at the bottom-right

## map generation
in the map generation, implement and model some rules that defines on which terrain tiles an accident/resource and units can be placed. For example, forrest cannot be placed on ocean, and fish cannot on which terrain accidents
So, on each accident, resource and unit, implement a mapping to define on which terrain tiles they can appear. Use your best judgement. 
There's a mapping to each terrain with probabilities of appear there. For example, forest can appear on plains and grassland but not on ocean or desert. Wheat can appear on plains and grassland but not on ocean, snow, desert. warrior cannot appear on ocean. Etc. Use your best judgement for each accident, resource and unit for existing terrains. Try to model this logic in some data types so it's easy to change or define new rules when new terrains, accidents ot units are introduced later.

## better tile content
in map generation, instead of showing terrain, accident, resource and unit initials on tile's corners, display a terrain, accident, resource and unit name list in the tile

## map terrain layout

in map generation algorithm I want to implement different terrain layouts, for example, terrain continents, lakes, panagea, inner sea, etc. Can you implement a first example of this terrain layout for "continents" layout where you generate two or more big terrain continents in the sea? Later we will implement other layouts so be generic enough

## more terrain layouts
on map generation, add other tile layout besides continents like:
 * "islands" (10 or more islands)
 * "panagea" (a bit single continent)
 * "inland sea" (a big sea sorounded by land)
 * "lakes" all tiles in the map are land with the exception of inner big lakes

## terrain layout selector
As a user I can select which terrain layout to use

## rules for land terrains
These are some rules for rendering each terrain tile in the layout. Most have to do with equatorial vs polar latitudes in the map.

 * desert rules: appear on equator or near it. They form small clusters / islands of desert. 
 * grassland : appear on meridian latitudes (not so equator not so polar). They appear in clusters / islands of grassland
 * plains : appear on meridian latitudes (not so equator not so polar). They appear in clusters / islands of plains
 * tundra: they appear near polar regions. 
 * ice: they appear in polar regions. 


## rules for land accidents
These are some rules for rendering each land accidents in the map

 * mountain rules: in a mass of land, they appear on a vertical or horizontal stripe
 * hill rules: they appear surrounding mountain tiles
 * forest rules: appears big clusters in grassland, and small clusters in plains and tundra. Never appear on desert, snow or ocean
 * jungle: appear only on grassland tiles, near the equator, as medium clusters
 * rivers: appears as lines that flows from mountains to the ocean
 * coast: appears in the ocean terrain, always if there is a land tile next to it
 * swamp: appears randomly in grassland near to north or south in medium clusters


## generate images for accidents

generate images for tile accidents. Images must be transparent and be render 1/4 of the tile size. Make them configurable


## generate images for resources

generate images for tile resources such as wheat, iron, fish, silk. Generate images for all resources. Images must be transparent and be render 1/2 of the tile size. Make them configurable. Although could be simple, images must represent very clearly the resource visually .


# tile click debug
when I click a tab there's a modal that details terrain, accidents, resources and units on that tile with icons and text

# multiple accidents
 
a tile can contain multiple accidents like hill+river or hill+forest


## generate images for units

generate images for tile all units defined in src/config/units.ts. Generate images for all units based on their description, displaying a very unit descriptive image like the weapon or tool they use. Images must be transparent and be render 1/2 of the tile size. Save all unit images in folder public/icons/units. Make them configurable. Although could be simple, images must represent very clearly the unit visually, please take into consideration units' descriptions . make sure in map generation we display the images for units instead their text labels

## wine resource image enhancement:
improve image  for wine resource, wine it should be represented with  grape fruit  

## improve the following images: 
!!!!Each of following was executed in a individual prompt:
 * improve units archer and longbowman images: archer should be rudimentary archer soldier pointing with arch and arrow while longbowman should be an advanced long archery unit with bow and advanced arrow.
 * improve the images of units: warrior, axeman, maceman. Please use colors and be as visually descriptive as you can:
    * warrior a poor man with a small maze
    * axeman: man more robust than warrior with big axe
    * maceman: big armoured man with big maze in hand
 * improve images of units lancer, pikeman. . Please use colors and be as visually descriptive as you can:
   * lancer is a rudimentary man with long pike pointing to its front
   * pikeman is an advanced armored man with long pike to its front
 * improve images of units chariot, horseman, knight, calvary. Please use colors and be as visually descriptive as you can:
   * chariot is a man on a chariot pulled by 2 horses
   * horseman is a man on horse armed with now and arrow
   * knight is a heavy armored man in horse with sword
   * calvary a modern mounted soldier with file gun
 * improve images of swordman: a man with iron sword. Please use colors and be as visually descriptive as you can
 * improve images of units catapult, trebuchet, cannon, artillery. Please use colors and be as visually descriptive as you can:
   * catapult: 4 wheel vehicle with rock launcher in the middle
   * trebuchet mobile tall advanced stone thrower, like catapult but taller and stronger
   * cannon: iron cannon 
   * artillery: modern precision artillery armored

* improve the following images. Please use colors and be as visually descriptive as you can. I want you to generate the svg images
  * worker: man, civil dressed, with shovel in hand
  * settler: two man, civil dressed, carrying bags
  * Corporate Executive: man with suite and portfolio in hand
  * Great Person: Man with long dress and carrying book in hand
  * spy: man in black clothes and covered face in black


## add units image path
in units file, add a property image which points to the local file in public/icons/units svg file for all units 

## units image in tile
when drawing map tiles, units are to be displayed using the image which should be 80% the size of the tile

## controls apply button
in controls component, there's an apply button, I can make changes some controls, but changes are applyed when I click it

## map performance

on medium maps, when I scroll or zoom out rendering is very slow. Can you render the whole map when app starts and then reuse it so it's not keep re-rendered on these map actions?

## tile click debug 2
when I click a tab there's a modal that details terrain, accidents, resources and units on that tile with icons and text

## game players
in the game, there are N players which are represented with:
{
  id: number
  civilizationId: number
  name: string
  color: string
}
* All Units and cities belong to one of the players.
* if a tile contains an unit or city, paint that tile with player's color with transparency 0.2
* create a map with 5 players by default, but let user change the number with controls

## player initial tile:
When game begins, each player starts in a location of the map. This location must be on a land tile which is grassland or plains. Separate each player initial location from each other equivalently.
On each player initial tile, there must be:
a city, and the units settler, worker and warrior


## zoom with wheel
A user can move mouse to a tile and use mouse wheel to zoom in and out. Current tile must be keep on the same place

## scroll drag
a user can scroll up&down the map by drag and drop on top of it


# TODO: 

 * we want gold, iron and others to spawn more in hills and mountains than in flat land
 * round map:, ie, i can go from 0 to the left and appear on max-width tile


## player turns
in a civilization game, each player is able to move its units and change some settings like city production, science, etc.
 * ai player vs human players
 * build all ai player and tech basic rules to move/produce units - test endturns


## tile production
each tile produces zero or more units of the following resources: food, gold, production (shields)





# tings that didn't work:

