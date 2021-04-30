import { html } from "./html";

async function init() {

	const audioCtx = new AudioContext();
	let source;

	//set up the different audio nodes we will use for the app
	const analyser = audioCtx.createAnalyser();
	analyser.minDecibels = -90;
	analyser.maxDecibels = -10;
	analyser.smoothingTimeConstant = 0.85;
	analyser.fftSize = 256; 
	const dataArrayAlt = new Uint8Array(analyser.frequencyBinCount);

	try {
		const response = await fetch('asesiname.m4a')
		const audioData = await response.arrayBuffer()
		source = audioCtx.createBufferSource();
		const buffer = await new Promise<AudioBuffer>((resolve, reject) => audioCtx.decodeAudioData(audioData, resolve, reject))
		source.buffer = buffer;
		// const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		// source = audioCtx.createMediaStreamSource(stream);
		source.connect(analyser);
		analyser.connect(audioCtx.destination);
	} catch (error) {
		console.error(error);
	}

	function analyze() {
		setTimeout(analyze, 500);
		// analyser.getByteFrequencyData(dataArrayAlt);
		analyser.getByteTimeDomainData(dataArrayAlt)
		console.log(Array.from(dataArrayAlt));
	}
	analyze();
}

export function main() {
	html();
	const heading = document.querySelector('h1')
	heading.textContent = 'CLICK ANYWHERE TO START'
	const click = () => {
		heading.textContent = 'Voice-change-O-matic';
		document.body.removeEventListener('click', click)
		init()
	}
	document.body.addEventListener('click', click);
}

main()
