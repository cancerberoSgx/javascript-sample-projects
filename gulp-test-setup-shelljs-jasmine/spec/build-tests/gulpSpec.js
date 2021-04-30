require('shelljs/global');

describe('tnpm and gulp basic', function() 
{
	it('npm install', function() 
	{
		console.log('npm install'); 
		rm('-rf', 'node_modules'); 
		expect(test('-d', 'node_modules')).toBe(false); 
		expect(exec('npm install', {silent:true}).code).toBe(0); 
		expect(test('-d', 'node_modules')).toBe(true); 
	});	

	it('gulp sass', function() 
	{
		console.log('gulp sass'); 
		rm('-rf', 'dist'); 
		expect(test('-d', 'dist')).toBe(false); 
		expect(exec('gulp sass', {silent:true}).code).toBe(0); 
		expect(test('-f', 'dist/main.css')).toBe(true); 
	});	

	it('gulp src', function() 
	{
		console.log('gulp src');
		rm('-rf', 'dist'); 
		expect(test('-d', 'dist')).toBe(false); 
		expect(exec('gulp src', {silent:true}).code).toBe(0); 
		expect(test('-f', 'dist/all.js')).toBe(true); 
	});	

});
