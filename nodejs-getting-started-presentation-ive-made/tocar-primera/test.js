#!/usr/bin/env node
console.log(process.argv)

const query = process.argv[2]

const api = require('my-spotify-api')

const results = api.search(query,['track'])
const primera = results.tracks.items[0].preview_url
var Player = require('player');

console.log('tocando ', primera)
// create a player instance from playlist
var player = new Player([
  primera
]);

// play again
player.play();

