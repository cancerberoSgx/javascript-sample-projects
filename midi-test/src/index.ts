import { randomItem, array } from 'misc-utils-of-mine-generic'
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
	installPlay3();
}

function installPlay3() {
	function play() {
		const tempo = 0.3 /* tempo unit in seconds */
		array(10)
		.map(i => {
			return [
				{ t: 0, notes: [NOTES[1]], volume: 1.0, duration: tempo },
				{ t: 1, notes: [NOTES[5]], volume: 0.5, duration: tempo },
				{ t: 2, notes: [NOTES[3]], volume: 0.2, duration: tempo },
			].map(n=>({...n, t: n.t*tempo+ i*tempo*3}))
		})
		.flat()
		.forEach(n=>{
			// player.queueWaveTable(audioContext, audioContext.destination, preset, n.t, n.notes[0] + 60, n.duration, n.volume);
			player.queueChord(audioContext, audioContext.destination, preset, n.t, n.notes.map(n=>n+60), n.duration, n.volume)
		})
	}
	append(`<button>generated</button>`).querySelector('button').addEventListener('click', e => {
		play();
	});
}

const NOTES = [0, 0, 2, 4, 5, 7, 9, 11]
function installPlay2() {
	const tempo = 0.3 /* tempo unit in seconds */
	let t = 0
	function playCompass() {
		const compass = [
			{ t: 0, notes: [NOTES[1]], volume: 1.0, duration: tempo },
			{ t: 1, notes: [NOTES[5]], volume: 0.5, duration: tempo },
			{ t: 2, notes: [NOTES[3]], volume: 0.2, duration: tempo },
		]
		compass.forEach(c => {
			player.queueWaveTable(audioContext, audioContext.destination, preset, t + c.t * tempo, c.notes[0] + 60, c.duration, c.volume);
		})
	}
	function play() {
		function f() {
			playCompass()
			t += tempo * 3
			setTimeout(f, tempo * 3 * 1000);
		}
		f()
	}
	append(`<button>timeout</button>`).querySelector('button').addEventListener('click', e => {
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


