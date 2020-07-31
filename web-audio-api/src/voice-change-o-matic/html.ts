import { append } from "./util";

export function html() {
	append(`
	<div class="wrapper">	
		<header>
			<h1>Voice-change-O-matic</h1>
		</header>
		
		<div>
			<label for="voice">Voice setting</label>
			<input id="voice" type="checkbox" name="voice">
			</input>
		</div>
		
		<div>
			<button class="mute">Mute</button>
		</div>
		<audio src="asesiname.m4a" autoplay controls></audio>
		<canvas width="256" height="256"></canvas>
	</div>
	`);
}
