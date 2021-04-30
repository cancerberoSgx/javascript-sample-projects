import { Preset } from "./WebAudioFontPlayer";

export function append(s, parent = document.body) {
	const e = document.createElement('div');
	e.innerHTML = s;
	parent.append(e);
	return e;
}

export async function loadJSONPreset(path: string): Promise<Preset> {
	const response = await fetch(path)
	const s = await response.text()
	return JSON.parse(s)
}
