import { randomItem } from 'misc-utils-of-mine-generic'
import { buildCadence, getNoteName } from './notes';
import { Player, Preset, IWebAudioFontPlayer } from './WebAudioFontPlayer'

function append(s, parent = document.body) {
	const e = document.createElement('div');
	e.innerHTML = s;
	parent.append(e);
	return e;
}

let player: IWebAudioFontPlayer
let audioContext: AudioContext
let preset: Preset

async function main1() {
	preset = await loadJSONPreset('0250_SoundBlasterOld_sf2.json')
	audioContext = new AudioContext();
	player = new Player();
	installPlay1();
	installPlay2();
}


function installPlay2() {
	const tempo = 0.3 /* tempo unit in seconds */
	let t = 0
	function playCompass() {
		const compass = [
			{ t: 0, notes: [0] },
			{ t: 1, notes: [7] },
			{ t: 2, notes: [5] },
		]
		compass.forEach(c => {
			player.queueWaveTable(audioContext, audioContext.destination, preset, t + c.t * tempo, c.notes[0] + 60, 0.3, 0.5);
		})
	}
	function play() {
		// const iterations = 10

		function f(){
			playCompass()
			t += tempo * 3
			setTimeout(f, tempo * 3 * 1000);
		}
		f()
		// setInterval(() => {
		// 	playCompass()
		// 	t += tempo * 3
		// }, tempo * 3 * 1000);
	}
	append(`<button>play2</button>`).querySelector('button').addEventListener('click', e => {
		play();
	});
}

function installPlay1() {
	function play1() {
		const cad = buildCadence(0, 'major');
		setInterval(() => {
			const note = Math.trunc(12 * 4 + randomItem(cad));
			console.log(getNoteName(note));
			player.queueWaveTable(audioContext, audioContext.destination, preset, 0, note, 0.3, 0.5);
			return false;
		}, 1000);
	}
	append(`<button>play1</button>`).querySelector('button').addEventListener('click', e => {
		play1();
	});
}

async function loadJSONPreset(path: string): Promise<Preset> {
	const response = await fetch(path)
	const s = await response.text()
	return JSON.parse(s)
}

main1()


