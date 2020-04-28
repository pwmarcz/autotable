import 'normalize.css';


import { World } from './world';
import { View } from './view';

const main = document.getElementById('main');

const world = new World();

window.world = world;
const view = new View(main, world);

window.view = view;

view.draw();

// const main = document.getElementById('main');
// import * as THREE from 'three';
// var scene = new THREE.Scene();
// var camera = new THREE.PerspectiveCamera( 75, 800/600, 0.1, 1000 );

// var renderer = new THREE.WebGLRenderer();
// renderer.setSize( 800, 600 );
// main.appendChild( renderer.domElement );

// var geometry = new THREE.BoxGeometry( 1, 1, 1 );
// var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// var cube = new THREE.Mesh( geometry, material );
// scene.add( cube );

// camera.position.z = 5;

// var animate = function () {
// 	requestAnimationFrame( animate );

// 	cube.rotation.x += 0.01;
// 	cube.rotation.y += 0.01;

// 	renderer.render( scene, camera );
// };

// animate();
