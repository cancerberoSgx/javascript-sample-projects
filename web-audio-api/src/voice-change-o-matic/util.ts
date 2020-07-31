
export function append(s, parent = document.body) {
	const e = document.createElement('div');
	e.innerHTML = s;
	parent.append(e);
	return e;
}
// /** supports legacy browsers */
// export function getAudioContext() {
// 	if (navigator.mediaDevices === undefined) {
// 		//@ts-ignore
// 		navigator.mediaDevices = {};
// 	}

// 	// Some browsers partially implement mediaDevices. We can't just assign an object
// 	// with getUserMedia as it would overwrite existing properties.
// 	// Here, we will just add the getUserMedia property if it's missing.
// 	if (navigator.mediaDevices.getUserMedia === undefined) {
// 		navigator.mediaDevices.getUserMedia = function (constraints) {

// 			// First get ahold of the legacy getUserMedia, if present
// 			//@ts-ignore
// 			var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

// 			// Some browsers just don't implement it - return a rejected promise with an error
// 			// to keep a consistent interface
// 			if (!getUserMedia) {
// 				return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
// 			}

// 			// Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
// 			return new Promise(function (resolve, reject) {
// 				getUserMedia.call(navigator, constraints, resolve, reject);
// 			});
// 		};
// 	}

// 	// set up forked web audio context, for multiple browsers
// 	// window. is needed otherwise Safari explodes
// 	//@ts-ignore
// 	var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
// 	return audioCtx as AudioContext;
// }
