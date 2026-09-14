"use client";

import { useEffect } from "react";
import { FirebaseApp, initializeApp } from "firebase/app";
import { Database, Unsubscribe, getDatabase, ref, set, get, update, push, remove, onValue, onChildAdded, onChildRemoved, onDisconnect } from "firebase/database";

type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

const enum ObjectType {
    None,
    Ship,
    Munition
};

const enum ObjectOwnership {
    None,
    Local,
    Remote
};

type Object = {
    type: ObjectType;
    ownership: ObjectOwnership;
    ref: any;
    x: number;
    y: number;
    rotation: number;
    velocity: number;
    clientX: number;
    clientY: number;
    clientRotation: number;
    clientVelocity: number;
    serverX: number;
    serverY: number;
    serverRotation: number;
    serverVelocity: number;
    texture: HTMLImageElement;
    textureRegion: Rect;
    shootTime: number;
    updateTime: number;
    blendTime: number;
    blendFactor: number;
    onValueUnsubscribe: Unsubscribe | null;
};

type Assets = {
    ships: HTMLImageElement;
    tiles: HTMLImageElement;
    map: HTMLImageElement;
};

type Game = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    requestId: number;
    timestamp: DOMHighResTimeStamp;
    accum: number;
    input: any;
    
    assets: Assets;
    objects: Object[];
    player: Object | null;

    app: FirebaseApp;
    db: Database;
    offsetVal: number;
};

export default function Canvas() {

    useEffect(() => {
        const canvas = document.querySelector("canvas");
        if (canvas === null) {
            return;
        }

        const ctx = canvas.getContext("2d");
        if (ctx === null) {
            return;
        }

        const firebaseConfig = {
            apiKey: "AIzaSyAF7df33ABVrRoHnyXeRAkAqHchsMSDSzk",
            authDomain: "pixel-shmup.firebaseapp.com",
            projectId: "pixel-shmup",
            storageBucket: "pixel-shmup.firebasestorage.app",
            messagingSenderId: "226791231751",
            appId: "1:226791231751:web:cb34c8d4d9478c0a2735a2"
        };
        const app = initializeApp(firebaseConfig);

        const game: Game = {
            canvas: canvas,
            ctx: ctx,

            requestId: 0,
            timestamp: 0.0,
            accum: 0.0,
            input: {},
            
            assets: {
                ships: new Image(),
                tiles: new Image(),
                map: new Image()
            },
            objects: [],
            player: null,

            app: app,
            db: getDatabase(app),
            offsetVal: 0.0
        };

        game.assets.ships.src = "./ships.png";
        game.assets.tiles.src = "./tiles.png";
        game.assets.map.src = "./map.png";

        const onKeydown = (e: KeyboardEvent) => { game.input[e.key] = true; };
        const onKeyup = (e: KeyboardEvent) => { game.input[e.key] = false; };
        const onBlur = (e: FocusEvent) => { game.input = {}; };
        const onResize = (e: UIEvent) => { resizeCanvas(game); };
        const onAnimationFrame = (timestamp: DOMHighResTimeStamp) => {
            if (game.timestamp !== undefined) {
                const deltatime = timestamp - game.timestamp;
                onStep(game, deltatime / 1000.0);

                /*game.accum = Math.min(game.accum + deltatime, 100.0);
                while (game.accum >= 1000.0 / 60.0) {
                    onStep(1.0 / 60.0);
                    game.accum -= 1000.0 / 60.0;
                }*/
            }
            game.timestamp = timestamp;

            onRender(game);
            game.requestId = requestAnimationFrame(onAnimationFrame);
        };

        window.addEventListener("keydown", onKeydown);
        window.addEventListener("keyup", onKeyup);
        window.addEventListener("blur", onBlur);
        window.addEventListener("resize", onResize);

        resizeCanvas(game);
        game.requestId = requestAnimationFrame(onAnimationFrame);

        const offsetRef = ref(game.db, ".info/serverTimeOffset");
        const onValueUnsubscribe = onValue(offsetRef, (data: any) => {
            game.offsetVal = data.val() || 0.0;
        });

        const onChildAddedUnsubscribe = onChildAdded(ref(game.db, "objects"), (data: any) => {
            if (game.player !== null && data.key === game.player.ref.key) {
                return;
            }
            
            const texture = Object.values(game.assets).find(asset => asset.src === data.val().texture);
            if (texture === undefined) {
                return;
            }

            const objectRef = ref(game.db, "objects/" + data.key);
            let offsetTime = getTimediff(game, data.val().timestamp || 0.0);
            const x = data.val().serverX + Math.sin(data.val().serverRotation) * data.val().serverVelocity * offsetTime;
            const y = data.val().serverY - Math.cos(data.val().serverRotation) * data.val().serverVelocity * offsetTime;

            const object: Object = {
                type: data.val().type,
                ownership: ObjectOwnership.Remote,
                ref: objectRef,
                x: x,
                y: y,
                rotation: data.val().serverRotation,
                velocity: data.val().serverVelocity,
                clientX: x,
                clientY: y,
                clientRotation: data.val().serverRotation,
                clientVelocity: data.val().serverVelocity,
                serverX: x,
                serverY: y,
                serverRotation: data.val().serverRotation,
                serverVelocity: data.val().serverVelocity,
                texture: texture,
                textureRegion: data.val().textureRegion,
                shootTime: 0.0,
                updateTime: 0.0,
                blendTime: 0.0,
                blendFactor: 1.0,
                onValueUnsubscribe: null,
            };
            game.objects.push(object);
            console.log(object);

            object.onValueUnsubscribe = onValue(objectRef, (data: any) => {
                if (data.val() !== null) {
                    let offsetTime = getTimediff(game, data.val().timestamp || 0.0);
                    object.clientX = object.x;
                    object.clientY = object.y;
                    object.clientRotation = object.rotation;
                    object.clientVelocity = object.velocity;
                    object.serverRotation = data.val().serverRotation;
                    object.serverVelocity = data.val().serverVelocity;
                    object.serverX = data.val().serverX + Math.sin(object.serverRotation) * object.serverVelocity * offsetTime;
                    object.serverY = data.val().serverY - Math.cos(object.serverRotation) * object.serverVelocity * offsetTime;
                    object.blendTime = 0.0;
                    object.blendFactor = 0.0;
                }
            });
        });

        const onChildRemovedUnsubscribe = onChildRemoved(ref(game.db, "objects"), (data: any) => {
            console.log(data);
            for (let i = 0; i < game.objects.length; i++) {
                if (game.objects[i].ref.key === data.key) {
                    game.objects.splice(i, 1);
                    return;
                }
            }
        });
        
        game.player = { 
            type: ObjectType.Ship,
            ownership: ObjectOwnership.Local,
            ref: push(ref(game.db, "objects")),
            x: 0, 
            y: 0,
            rotation: 0,
            velocity: 16.0,
            clientX: 0, 
            clientY: 0,
            clientRotation: 0.0,
            clientVelocity: 0.0,
            serverX: 0, 
            serverY: 0,
            serverRotation: 0.0,
            serverVelocity: 0.0,
            texture: game.assets.ships,
            textureRegion: { x: Math.floor(Math.random() * 4) * 32, y: Math.floor(Math.random() * 3) * 32, w: 32, h: 32 },
            shootTime: 0.0,
            updateTime: 0.0,
            blendTime: 0.0,
            blendFactor: 0.0,
            onValueUnsubscribe: null
        };
        addObject(game, game.player);

        return () => {
            window.removeEventListener("keydown", onKeydown);
            window.removeEventListener("keyup", onKeyup);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(game.requestId);
            onValueUnsubscribe();
            onChildAddedUnsubscribe();
            for (let i = 0; i < game.objects.length; i++) {
                const object = game.objects[i];
                if (object.onValueUnsubscribe !== null) {
                    object.onValueUnsubscribe();
                } else {
                    remove(object.ref);
                }
            }
            onChildRemovedUnsubscribe();
        };
    }, []);

    return (
        <canvas></canvas>
    );
}

function onStep(game: Game, deltatime: number) {
    const newObjects: Object[] = [];
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];

        if (object.type === ObjectType.Ship && object.ownership === ObjectOwnership.Local) {
            const x = (game.input["ArrowRight"] || 0.0) - (game.input["ArrowLeft"] || 0.0);
            const y = (game.input["ArrowUp"] || 0.0) - (game.input["ArrowDown"] || 0.0);

            object.velocity = Math.max(8.0, Math.min(object.velocity + y * deltatime * 8.0, 32.0));
            object.x += Math.sin(object.rotation) * object.velocity * deltatime;
            object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            object.rotation += x * deltatime * Math.PI;
            newObjects.push(object);

            if (object.shootTime === 0.0 && (game.input["z"] || game.input["Z"])) {
                object.shootTime = 0.1;
                addObject(game, {
                    type: ObjectType.Munition,
                    ownership: ObjectOwnership.Local,
                    ref: push(ref(game.db, "objects")),
                    x: object.x + Math.sin(object.rotation) * 1.0,
                    y: object.y - Math.cos(object.rotation) * 1.0,
                    rotation: object.rotation,
                    velocity: 64.0,
                    clientX: 0, 
                    clientY: 0,
                    clientRotation: 0.0,
                    clientVelocity: 0.0,
                    serverX: 0, 
                    serverY: 0,
                    serverRotation: 0.0,
                    serverVelocity: 0.0,
                    texture: game.assets.tiles,
                    textureRegion: { x: 0, y: 0, w: 16, h: 16 },
                    shootTime: 0.0,
                    updateTime: 0.0,
                    blendTime: 0.0,
                    blendFactor: 0.0,
                    onValueUnsubscribe: null
                });
            } else if (object.shootTime > 0.0) {
                object.shootTime = Math.max(0.0, object.shootTime - deltatime);
            }

            if (object.updateTime === 0.0 && (object.rotation !== object.serverRotation || object.velocity !== object.serverVelocity)) {
                object.updateTime = 0.1;
                object.serverRotation = object.rotation;
                object.serverVelocity = object.velocity;
                update(object.ref, {
                    serverX: object.x, 
                    serverY: object.y,
                    serverRotation: object.rotation,
                    serverVelocity: object.velocity,
                    timestamp: getTimestamp(game)
                });
            } else if (object.updateTime > 0.0) {
                object.updateTime = Math.max(0.0, object.updateTime - deltatime);
            }

        } else if (object.type === ObjectType.Munition && object.ownership === ObjectOwnership.Local) {
            object.x += Math.sin(object.rotation) * object.velocity * deltatime;
            object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            object.shootTime += deltatime;
            if (object.shootTime < 1.0) {
                newObjects.push(object);
            } else {
                remove(object.ref);
            }
        } else if (object.ownership === ObjectOwnership.Remote) {
            if (object.blendFactor < 1.0) {
                object.blendTime += deltatime;
                object.blendFactor = Math.min(object.blendFactor + deltatime / 0.2, 1.0);
                object.rotation = boundedLerp(object.clientRotation, object.serverRotation, object.blendFactor, -Math.PI, Math.PI);
                object.velocity = lerp(object.clientVelocity, object.serverVelocity, object.blendFactor);
                const clientX = object.clientX + Math.sin(object.rotation) * object.velocity * object.blendTime;
                const clientY = object.clientY - Math.cos(object.rotation) * object.velocity * object.blendTime;
                const serverX = object.serverX + Math.sin(object.serverRotation) * object.serverVelocity * object.blendTime;
                const serverY = object.serverY - Math.cos(object.serverRotation) * object.serverVelocity * object.blendTime;
                object.x = boundedLerp(clientX, serverX, object.blendFactor, 0, game.assets.map.width / 16.0);
                object.y = boundedLerp(clientY, serverY, object.blendFactor, 0, game.assets.map.height / 16.0);
            } else {
                object.x += Math.sin(object.rotation) * object.velocity * deltatime;
                object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            }
            newObjects.push(object);
        }
    
        object.x = modfract(object.x, game.assets.map.width / 16.0);
        object.y = modfract(object.y, game.assets.map.height / 16.0);
        object.rotation = modfract(object.rotation + Math.PI, Math.PI * 2.0) - Math.PI;
    }
    game.objects = newObjects;
}

function onRender(game: Game) {
    game.ctx.reset();
    game.ctx.imageSmoothingEnabled = false;
    game.ctx.fillStyle = "black";
    game.ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);

    game.ctx.resetTransform();
    game.ctx.translate(game.canvas.width * 0.5, game.canvas.height * 0.5);
    const dpr = window.devicePixelRatio || 1;
    game.ctx.scale(dpr, dpr);
    game.ctx.scale(32, 32);

    if (game.player !== null)
    {
        game.ctx.translate(-game.player.x, -game.player.y);
    }
    {
        game.ctx.save();
        game.ctx.filter = "blur(1px)";
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                game.ctx.drawImage(game.assets.map, x * game.assets.map.width / 16.0, y * game.assets.map.height / 16.0, game.assets.map.width / 16.0, game.assets.map.height / 16.0);
            }
        }
        game.ctx.restore();
    }

    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        game.ctx.save();

        if (object.type === ObjectType.Ship) {
            game.ctx.shadowColor = "rgb(0 0 0 / 25%)";
            game.ctx.shadowBlur = 2;
            game.ctx.shadowOffsetY = 24;
        } else if (object.type === ObjectType.Munition) {
            game.ctx.shadowColor = "#ffbd20";
            game.ctx.shadowBlur = 16;
        }

        let x = object.x;
        let y = object.y;

        if (x - (game.player?.x ?? 0.0) > game.assets.map.width / 32.0) { x -= game.assets.map.width / 16.0; }
        if (x - (game.player?.x ?? 0.0) < -game.assets.map.width / 32.0) { x += game.assets.map.width / 16.0; }
        if (y - (game.player?.y ?? 0.0) > game.assets.map.height / 32.0) { y -= game.assets.map.height / 16.0; }
        if (y - (game.player?.y ?? 0.0) < -game.assets.map.height / 32.0) { y += game.assets.map.height / 16.0; }

        game.ctx.translate(x, y);
        game.ctx.rotate(object.rotation);
        game.ctx.translate(-object.textureRegion.w / 32, -object.textureRegion.h / 32);
        game.ctx.drawImage(object.texture, object.textureRegion.x, object.textureRegion.y, object.textureRegion.w, object.textureRegion.h, 0, 0, object.textureRegion.w / 16, object.textureRegion.h / 16);
        game.ctx.restore();
    }
}

function resizeCanvas(game: Game) {
    const dpr = window.devicePixelRatio || 1;
    game.canvas.width = window.innerWidth * dpr;
    game.canvas.height = window.innerHeight * dpr;
}

function lerp(a: number, b: number, t: number) {
    return a * (1.0 - t) + b * t;
}

function boundedLerp(a: number, b: number, t: number, min: number, max: number) {
    let delta = b - a;
    if ((max - min) - Math.abs(delta) < Math.abs(delta)) { delta = ((max - min) - Math.abs(delta)) * Math.sign(-delta); }
    return a + delta * t;
}

function modfract(a: number, b: number) {
    return b === 0.0 ? a : a - Math.floor(a / b) * b;
}

function getTimestamp(game: Game) {
    if (game.offsetVal !== null) {
        return new Date().getTime() + game.offsetVal;
    } else {
        return 0.0;
    }
}

function getTimediff(game: Game, timestamp: number) {
    if (timestamp !== 0.0 && game.offsetVal !== null) {
        return (getTimestamp(game) - timestamp) / 1000.0;
    } else {
        return 0.0;
    }
}

function addObject(game: Game, object: Object) {
    game.objects.push(object);
    onDisconnect(object.ref).remove();
    set(object.ref, {
        type: object.type,
        serverX: object.x, 
        serverY: object.y,
        serverRotation: object.rotation,
        serverVelocity: object.velocity,
        texture: object.texture.src,
        textureRegion: object.textureRegion,
        timestamp: getTimestamp(game)
    });
}
