import { mapRegionFocusDisplay } from "$lib/map/visibility";
import { mapElementTacticalRecipe } from "$lib/map/element-subtypes";
import { MAP_FONT_DEFAULT_ID, MAP_FONTS } from "$lib/map/fonts";
import {
	formatMapDistance,
	mapElementLabelName,
	mapGradientLine,
	mapPathDistance,
	mapPointMidpoint,
	type MapBounds,
} from "$lib/map/geometry";
import {
	type MapNameArcLayout,
	type MapNameArcLine,
	mapNameArcLines,
	mapPointInPolygon,
	mapPathLabelArcLayout,
	mapPathLabelSample,
} from "$lib/map/name-arc";
import type {
	MapRenderHit,
	MapRenderPointAction,
	MapRenderScene,
	MapRenderView,
} from "$lib/map/render-scene";
import type {
	MapElement,
	MapElementArea,
	MapElementPath,
	MapElementRegion,
	MapElementStyle,
	MapElementSymbol,
	MapElementTactical,
	MapPoint,
} from "$lib/map/types";
import {
	type MapWebglMesh,
	type MapWebglElementMeshes,
	type MapWebglPathCommand,
	mapWebglCircleMesh,
	mapWebglCompoundFillMesh,
	mapWebglElementGeometryKey,
	mapWebglElementMeshes,
	mapWebglGridElementMeshes,
	mapWebglNameCurveLength,
	mapWebglNameCurveSample,
	mapWebglPathContours,
	mapWebglPathSegments,
	mapWebglPointBounds,
	mapWebglRectangleMesh,
	mapWebglStrokeMesh,
} from "$lib/map/webgl-geometry";
import type {
	MapWebglGeometryRequest,
	MapWebglGlyphRequest,
	MapWebglWorkerResult,
} from "$lib/map/webgl-geometry.worker";

export type MapWebglHit = MapRenderHit;
export type MapWebglPointAction = MapRenderPointAction;

type MapWebglScene = MapRenderScene;
type MapWebglView = MapRenderView;

export type MapWebglRendererOptions = {
	geometryWorkerEnabled?: boolean;
	pickingEnabled?: boolean;
	interactionEnabled?: boolean;
	editorOverlayEnabled?: boolean;
	labelsEnabled?: boolean;
};

type MapWebglTarget = {
	framebuffer: WebGLFramebuffer;
	texture: WebGLTexture;
};

type MapWebglImage = {
	image: HTMLImageElement;
	texture: WebGLTexture | null;
	loading: boolean;
	failed: boolean;
	owned: boolean;
	invalidateWhenReady: boolean;
	background: boolean;
	elementIds: Set<string>;
};

type MapWebglGlyph = {
	advance: number;
	commands: MapWebglPathCommand[];
	contours?: MapPoint[][];
	fill?: MapWebglMesh;
	outlines?: Map<string, Float32Array>;
};

type MapWebglFontData = {
	version: 1;
	type: "vector";
	unitsPerEm: number;
	glyphs: Record<string, MapWebglGlyph>;
	kerning: Record<string, Record<string, number>>;
};

type MapWebglFont = {
	id: string;
	sourceVector: string;
	data: MapWebglFontData | null;
	loading: boolean;
	failed: boolean;
	invalidateWhenReady: boolean;
	elementIds: Set<string>;
};

type MapWebglShapeProgram = {
	program: WebGLProgram;
	position: number;
	visibilityIndex: number;
	colorStart: number;
	colorEnd: number;
	gradientStart: number;
	gradientEnd: number;
	gradientOffset: number;
	view: WebGLUniformLocation;
	size: WebGLUniformLocation;
	localTransform: WebGLUniformLocation;
	visibility: WebGLUniformLocation;
	visibilityWidth: WebGLUniformLocation;
};

type MapWebglTextureProgram = {
	program: WebGLProgram;
	position: number;
	visibilityIndex: number;
	textureCoordinate: number;
	round: number;
	view: WebGLUniformLocation;
	size: WebGLUniformLocation;
	texture: WebGLUniformLocation;
	localTransform: WebGLUniformLocation;
	visibility: WebGLUniformLocation;
	visibilityWidth: WebGLUniformLocation;
};

type MapWebglPickProgram = {
	program: WebGLProgram;
	position: number;
	visibilityIndex: number;
	color: number;
	view: WebGLUniformLocation;
	size: WebGLUniformLocation;
	visibility: WebGLUniformLocation;
	visibilityWidth: WebGLUniformLocation;
};

type MapWebglScreenProgram = {
	program: WebGLProgram;
	position: number;
	textureCoordinate: number;
	texture: WebGLUniformLocation;
	direction: WebGLUniformLocation | null;
	textureMask: WebGLUniformLocation | null;
	opacity: WebGLUniformLocation | null;
	inner: WebGLUniformLocation | null;
};

type MapWebglShapeCommand = {
	kind: "shape";
	offset: number;
	count: number;
};

type MapWebglTextureCommand = {
	kind: "texture";
	offset: number;
	count: number;
	texture: WebGLTexture;
	elementId?: string;
};

type MapWebglVectorTextCommand = {
	kind: "vectorText";
	offset: number;
	count: number;
	anchor: MapPoint;
	scaleMode: "map" | "screen" | "clamp";
	elementId?: string;
};

type MapWebglCommand = MapWebglShapeCommand | MapWebglTextureCommand | MapWebglVectorTextCommand;

type MapWebglFrame = {
	commands: MapWebglCommand[];
	shapeVertices: Float32Array;
	textureVertices: Float32Array;
	pickVertices: Float32Array;
	pickHits: Map<number, MapWebglHit>;
	elementRanges: Map<string, MapWebglElementRange>;
};

type MapWebglElementRange = {
	shapeOffset: number;
	shapeLength: number;
	textureOffset: number;
	textureLength: number;
	pickOffset: number;
	pickLength: number;
	pickIdStart: number;
	pickIdEnd: number;
	commands: MapWebglCommand[];
};

type MapWebglRetainedFrame = {
	commands: MapWebglCommand[];
	shapeVertices: Float32Array;
	textureVertices: Float32Array;
	pickVertices: Float32Array;
	shapeBuffer: WebGLBuffer;
	textureBuffer: WebGLBuffer;
	pickBuffer: WebGLBuffer;
	pickVertexCount: number;
	pickHits: Map<number, MapWebglHit>;
	elementRanges: Map<string, MapWebglElementRange>;
	colorTexture: WebGLTexture | null;
	colorWidth: number;
	colorHeight: number;
	colorViewKey: string;
};

type MapWebglFrameBuilder = {
	commands: MapWebglCommand[];
	shapeVertices: number[];
	textureVertices: number[];
	pickVertices: number[];
	pickHits: Map<number, MapWebglHit>;
	pickId: number;
	pickingEnabled: boolean;
	shapeStart: number | null;
	visibilityIndex: number;
	elementId?: string;
	elementRanges: Map<string, MapWebglElementRange>;
};

type MapWebglInteractionTransition = {
	opacity: number;
	startOpacity: number;
	targetOpacity: number;
	timeStart: number;
};

const SHAPE_STRIDE = 16;
const TEXTURE_STRIDE = 6;
const PICK_STRIDE = 6;
const SCREEN_STRIDE = 4;
const VISIBILITY_TEXTURE_WIDTH = 256;
const INTERACTION_TRANSITION_DURATION = 160;
const SCREEN_QUAD = new Float32Array([
	-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1,
]);

const VERTEX_SHAPE = `#version 300 es
in vec2 a_position;
in float a_visibilityIndex;
in vec4 a_colorStart;
in vec4 a_colorEnd;
in vec2 a_gradientStart;
in vec2 a_gradientEnd;
in float a_gradientOffset;
uniform vec3 u_view;
uniform vec2 u_size;
uniform vec3 u_localTransform;
uniform sampler2D u_visibility;
uniform int u_visibilityWidth;
out vec2 v_world;
out vec4 v_colorStart;
out vec4 v_colorEnd;
out vec2 v_gradientStart;
out vec2 v_gradientEnd;
out float v_gradientOffset;
void main() {
	vec2 position = u_localTransform.xy + (a_position - u_localTransform.xy) * u_localTransform.z;
	vec2 screen = position * u_view.z + u_view.xy;
	vec2 clip = screen / u_size * 2.0 - 1.0;
	int visibilityIndex = int(a_visibilityIndex + 0.5);
	ivec2 visibilityPoint = ivec2(visibilityIndex % u_visibilityWidth, visibilityIndex / u_visibilityWidth);
	float visible = texelFetch(u_visibility, visibilityPoint, 0).r;
	gl_Position = visible < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(clip.x, -clip.y, 0.0, 1.0);
	v_world = position;
	v_colorStart = a_colorStart;
	v_colorEnd = a_colorEnd;
	v_gradientStart = a_gradientStart;
	v_gradientEnd = a_gradientEnd;
	v_gradientOffset = a_gradientOffset;
}`;

const FRAGMENT_SHAPE = `#version 300 es
precision mediump float;
in vec2 v_world;
in vec4 v_colorStart;
in vec4 v_colorEnd;
in vec2 v_gradientStart;
in vec2 v_gradientEnd;
in float v_gradientOffset;
out vec4 outColor;
void main() {
	vec2 line = v_gradientEnd - v_gradientStart;
	float divisor = max(dot(line, line), 0.0001);
	float position = dot(v_world - v_gradientStart, line) / divisor;
	float amount = clamp((position - v_gradientOffset) / max(1.0 - v_gradientOffset, 0.0001), 0.0, 1.0);
	outColor = mix(v_colorStart, v_colorEnd, amount);
	if (v_gradientOffset < 0.0) {
		float square = mod(floor(v_world.x / 24.0) + floor(v_world.y / 24.0), 2.0);
		outColor.a *= mix(0.35, 1.0, square);
	}
}`;

const VERTEX_TEXTURE = `#version 300 es
in vec2 a_position;
in float a_visibilityIndex;
in vec2 a_textureCoordinate;
in float a_round;
uniform vec3 u_view;
uniform vec2 u_size;
uniform vec3 u_localTransform;
uniform sampler2D u_visibility;
uniform int u_visibilityWidth;
out vec2 v_textureCoordinate;
out float v_round;
void main() {
	vec2 position = u_localTransform.xy + (a_position - u_localTransform.xy) * u_localTransform.z;
	vec2 screen = position * u_view.z + u_view.xy;
	vec2 clip = screen / u_size * 2.0 - 1.0;
	int visibilityIndex = int(a_visibilityIndex + 0.5);
	ivec2 visibilityPoint = ivec2(visibilityIndex % u_visibilityWidth, visibilityIndex / u_visibilityWidth);
	float visible = texelFetch(u_visibility, visibilityPoint, 0).r;
	gl_Position = visible < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(clip.x, -clip.y, 0.0, 1.0);
	v_textureCoordinate = a_textureCoordinate;
	v_round = a_round;
}`;

const FRAGMENT_TEXTURE = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_textureCoordinate;
in float v_round;
out vec4 outColor;
void main() {
	if (v_round > 0.5 && distance(v_textureCoordinate, vec2(0.5)) > 0.5) discard;
	outColor = texture(u_texture, v_textureCoordinate);
}`;

const VERTEX_PICK = `#version 300 es
in vec2 a_position;
in float a_visibilityIndex;
in vec3 a_color;
uniform vec3 u_view;
uniform vec2 u_size;
uniform sampler2D u_visibility;
uniform int u_visibilityWidth;
out vec3 v_color;
void main() {
	vec2 screen = a_position * u_view.z + u_view.xy;
	vec2 clip = screen / u_size * 2.0 - 1.0;
	int visibilityIndex = int(a_visibilityIndex + 0.5);
	ivec2 visibilityPoint = ivec2(visibilityIndex % u_visibilityWidth, visibilityIndex / u_visibilityWidth);
	float visible = texelFetch(u_visibility, visibilityPoint, 0).g;
	gl_Position = visible < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(clip.x, -clip.y, 0.0, 1.0);
	v_color = a_color;
}`;

const FRAGMENT_PICK = `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 outColor;
void main() {
	outColor = vec4(v_color, 1.0);
}`;

const VERTEX_SCREEN = `#version 300 es
in vec2 a_position;
in vec2 a_textureCoordinate;
out vec2 v_textureCoordinate;
void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
	v_textureCoordinate = a_textureCoordinate;
}`;

const FRAGMENT_GLOW_BLUR = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_direction;
in vec2 v_textureCoordinate;
out vec4 outColor;
void main() {
	vec4 color = vec4(0.0);
	float weightTotal = 0.0;
	for (int index = -6; index <= 6; index += 1) {
		float position = float(index);
		float weight = exp(-0.5 * position * position / 9.0);
		color += texture(u_texture, v_textureCoordinate + u_direction * position) * weight;
		weightTotal += weight;
	}
	outColor = color / weightTotal;
}`;

const FRAGMENT_GLOW = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform sampler2D u_textureMask;
uniform float u_opacity;
uniform float u_inner;
in vec2 v_textureCoordinate;
out vec4 outColor;
void main() {
	float blurredAlpha = texture(u_texture, v_textureCoordinate).a;
	float shapeAlpha = texture(u_textureMask, v_textureCoordinate).a;
	float glowAlpha = (u_inner > 0.5
		? max(shapeAlpha - blurredAlpha, 0.0)
		: max(blurredAlpha - shapeAlpha, 0.0)) * u_opacity;
	outColor = vec4(0.8941, 0.7059, 0.4471, glowAlpha);
}`;

const FRAGMENT_PRESENT = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_textureCoordinate;
out vec4 outColor;
void main() {
	outColor = texture(u_texture, v_textureCoordinate);
}`;

/**
 * Owns the WebGL resources for one map canvas.
 */
export class MapWebglRenderer {
	readonly gl: WebGL2RenderingContext;
	readonly canvas: HTMLCanvasElement;
	readonly invalidate: () => void;
	readonly reportError: (error: Error) => void;
	readonly shapeProgram: MapWebglShapeProgram;
	readonly textureProgram: MapWebglTextureProgram;
	readonly pickProgram: MapWebglPickProgram;
	readonly glowBlurProgram: MapWebglScreenProgram;
	readonly glowProgram: MapWebglScreenProgram;
	readonly presentProgram: MapWebglScreenProgram;
	readonly interactionBuffer: WebGLBuffer;
	readonly interactionTextureBuffer: WebGLBuffer;
	readonly overlayShapeBuffer: WebGLBuffer;
	readonly overlayTextureBuffer: WebGLBuffer;
	readonly overlayPickBuffer: WebGLBuffer;
	readonly screenBuffer: WebGLBuffer;
	readonly visibilityTexture: WebGLTexture;
	readonly imageBySource = new Map<string, MapWebglImage>();
	readonly meshesByElementId = new Map<string, MapWebglElementMeshes>();
	readonly fontsById = new Map<string, MapWebglFont>();
	readonly interactionTransitions = new Map<string, MapWebglInteractionTransition>();
	private readonly pickingEnabled: boolean;
	private readonly interactionEnabled: boolean;
	private readonly editorOverlayEnabled: boolean;
	private readonly labelsEnabled: boolean;
	private geometryWorker: Worker | null;
	private geometryRequestId = 0;
	private geometryRequestPending = 0;
	private geometryWorkerFailed = false;
	private targets: MapWebglTarget[] = [];
	private targetWidth = 0;
	private targetHeight = 0;
	private frame: MapWebglRetainedFrame | null = null;
	private frameFocus: MapWebglRetainedFrame | null = null;
	private frameFocusKey = "";
	private regionCompositeIds = new Set<string>();
	private elementsAllLast: MapElement[] | null = null;
	private frameBackground: MapWebglRetainedFrame | null = null;
	private imageTilesLast: MapWebglScene["imageTiles"];
	private imageSourceLast = "";
	private elementsPrepared: MapElement[] | null = null;
	private frameEditing: MapWebglRetainedFrame | null = null;
	private frameRuler: MapWebglRetainedFrame | null = null;
	private overlayFrame: MapWebglFrame | null = null;
	private frameCacheRevision = "";
	private frameOrderRevision = "";
	private frameEditingRevision = "";
	private frameFocusedRegionMode: MapWebglScene["focusedRegionMode"];
	private frameFocusedRegionId: string | null = null;
	private elementEditingId: string | null = null;
	private visibilityRevision = "";
	private visibilityWidth = 1;
	private visibilityIndexes = new Map<string, number>();
	private frameRulerRevision = "";
	private rulerGlyphUnit: string | null = null;
	private frameRulerZoom = 0;
	private frameRulerPickIdStart = -1;
	private overlayFrameRevision = "";
	private overlayFrameZoom = 0;
	private editHoverKey: string | null = null;
	private pickDirty = true;
	private destroyed = false;
	private interactionFrame = 0;
	private resourceRevision = "";
	private resourceBackgroundChanged = false;
	private resourceElementIdsChanged = new Set<string>();
	private attributeKey = "";
	private sceneLast: MapWebglScene | null = null;
	private view: MapWebglView = {
		width: 1,
		height: 1,
		panX: 0,
		panY: 0,
		zoom: 1,
		colorCache: false,
	};

	/**
	 * Creates a WebGL map renderer.
	 *
	 * @param canvas - The canvas that receives the map.
	 * @param invalidate - The function to call after an image becomes ready.
	 * @param reportError - The function to call after a resource or worker error.
	 * @param options - Optional renderer capabilities.
	 * @throws An error when WebGL 2 or a required GPU resource is unavailable.
	 */
	constructor(
		canvas: HTMLCanvasElement,
		invalidate: () => void,
		reportError: (error: Error) => void = console.error,
		options: MapWebglRendererOptions = {},
	) {
		const gl = canvas.getContext("webgl2", {
			alpha: true,
			antialias: true,
			depth: false,
			premultipliedAlpha: false,
			preserveDrawingBuffer: false,
			stencil: false,
		});
		if (!gl) throw new Error("WebGL 2 is unavailable.");
		this.gl = gl;
		this.canvas = canvas;
		this.invalidate = invalidate;
		this.reportError = reportError;
		this.pickingEnabled = options.pickingEnabled ?? true;
		this.interactionEnabled = options.interactionEnabled ?? true;
		this.editorOverlayEnabled = options.editorOverlayEnabled ?? true;
		this.labelsEnabled = options.labelsEnabled ?? true;
		const geometryWorkerEnabled = options.geometryWorkerEnabled ?? true;
		this.geometryWorker = geometryWorkerEnabled
			? new Worker(new URL("./webgl-geometry.worker.ts", import.meta.url), { type: "module" })
			: null;
		this.geometryWorkerFailed = !geometryWorkerEnabled;
		this.geometryWorker?.addEventListener("message", (event) => {
			this.handleGeometryResult(event as MessageEvent<MapWebglWorkerResult>);
		});
		this.geometryWorker?.addEventListener("error", () => {
			this.handleGeometryError();
		});
		this.shapeProgram = mapWebglCreateShapeProgram(gl);
		this.textureProgram = mapWebglCreateTextureProgram(gl, FRAGMENT_TEXTURE);
		this.pickProgram = mapWebglCreatePickProgram(gl);
		this.glowBlurProgram = mapWebglCreateScreenProgram(gl, FRAGMENT_GLOW_BLUR);
		this.glowProgram = mapWebglCreateScreenProgram(gl, FRAGMENT_GLOW);
		this.presentProgram = mapWebglCreateScreenProgram(gl, FRAGMENT_PRESENT);
		this.interactionBuffer = mapWebglCreateBuffer(gl);
		this.interactionTextureBuffer = mapWebglCreateBuffer(gl);
		this.overlayShapeBuffer = mapWebglCreateBuffer(gl);
		this.overlayTextureBuffer = mapWebglCreateBuffer(gl);
		this.overlayPickBuffer = mapWebglCreateBuffer(gl);
		this.screenBuffer = mapWebglCreateBuffer(gl);
		const visibilityTexture = gl.createTexture();
		if (!visibilityTexture) throw new Error("WebGL cannot create a visibility texture.");
		this.visibilityTexture = visibilityTexture;
		gl.bindTexture(gl.TEXTURE_2D, visibilityTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.R8,
			1,
			1,
			0,
			gl.RED,
			gl.UNSIGNED_BYTE,
			new Uint8Array([255]),
		);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.screenBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, SCREEN_QUAD, gl.STATIC_DRAW);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		if (import.meta.env.DEV) mapWebglThrowError(gl, "renderer setup");
	}

	/**
	 * Draws a complete map scene.
	 *
	 * @param scene - The map data and transient editor overlays.
	 * @param view - The current viewport transform.
	 * @returns The image and base-frame readiness state.
	 * @sideEffects Resizes and paints the renderer canvas.
	 */
	draw(scene: MapWebglScene, view: MapWebglView): { imagePresented: boolean; ready: boolean } {
		this.sceneLast = scene;
		if (this.elementsAllLast !== scene.elementsAll) {
			this.overlayFrameRevision = "";
			this.elementsAllLast = scene.elementsAll;
			const ids = new Set(scene.elementsAll.map((element) => element.id));
			for (const id of this.meshesByElementId.keys())
				if (!ids.has(id)) this.meshesByElementId.delete(id);
			const regionCompositeIds = new Set(
				scene.elementsAll.flatMap((element) =>
					element.parentRegionId ? [element.parentRegionId] : [],
				),
			);
			for (const id of this.regionCompositeIds) {
				if (!regionCompositeIds.has(id)) this.resourceElementIdsChanged.add(id);
			}
			for (const id of regionCompositeIds) {
				if (!this.regionCompositeIds.has(id)) this.resourceElementIdsChanged.add(id);
			}
			this.regionCompositeIds = regionCompositeIds;
		}
		const image = this.getImage(
			scene.imageSource,
			scene.imageElement,
			true,
			true,
			undefined,
			true,
		);
		const elementEditingRequested = scene.overlay.editingElementId
			? scene.elements.find((element) => element.id === scene.overlay.editingElementId)
			: undefined;
		const elementEditingId =
			elementEditingRequested?.type === "grid"
				? null
				: (scene.overlay.editingElementId ?? null);
		this.prepareSceneResources(scene);
		this.updateVisibility(scene);
		// A capped pixel ratio keeps the parchment map crisp while avoiding a
		// quadratic fill-rate cost on HiDPI screens.
		const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5);
		const width = Math.max(1, Math.round(view.width * ratio));
		const height = Math.max(1, Math.round(view.height * ratio));
		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
		}
		this.view = view;
		this.resizeTargets(width, height);
		const elementsWorker = elementEditingId
			? scene.elements.filter((element) => element.id !== elementEditingId)
			: scene.elements;
		const rulerGlyphUnit =
			scene.overlay.rulerPaths.length > 0 || scene.overlay.rulerPreviewPoints.length > 1
				? scene.config.scale.unit
				: null;
		if (this.rulerGlyphUnit !== rulerGlyphUnit) {
			this.rulerGlyphUnit = rulerGlyphUnit;
			this.elementsPrepared = null;
		}
		const geometryReady =
			this.elementsPrepared === scene.elements || this.ensureSceneGeometry(elementsWorker);
		const resourcesReady =
			this.elementsPrepared === scene.elements || this.sceneBaseResourcesReady(scene);
		if (!geometryReady || !resourcesReady) {
			return { imagePresented: Boolean(image.texture), ready: false };
		}
		if (this.elementsPrepared !== scene.elements) {
			if (this.labelsEnabled) this.prepareSceneGlyphs(scene);
			if (this.geometryRequestPending)
				return { imagePresented: Boolean(image.texture), ready: false };
			this.elementsPrepared = scene.elements;
			this.warmSceneGeometry(scene.elementsAll);
		}
		if (
			!this.frameBackground ||
			this.imageSourceLast !== scene.imageSource ||
			this.imageTilesLast !== scene.imageTiles ||
			this.resourceBackgroundChanged
		) {
			const background = mapWebglFinishFrame(this.createFrameBuilder(scene, true, 0));
			if (this.frameBackground) this.updateRetainedFrame(this.frameBackground, background);
			else this.frameBackground = this.retainFrame(background);
			this.imageSourceLast = scene.imageSource;
			this.imageTilesLast = scene.imageTiles;
			this.resourceBackgroundChanged = false;
			if (this.frame) this.frame.colorViewKey = "";
		}
		if (this.elementEditingId && this.elementEditingId !== elementEditingId) {
			const committed = this.commitEditingFrame(this.elementEditingId);
			if (committed) {
				this.frameCacheRevision = scene.contentRevision;
			} else if (
				this.frame &&
				this.reconcileRetainedFrame(this.frame, scene, [this.elementEditingId])
			) {
				this.frameCacheRevision = scene.contentRevision;
				this.frameOrderRevision = scene.orderRevision;
			} else this.setFrameCacheRevision(scene.contentRevision);
			this.elementEditingId = null;
		}
		const resourcesChanged =
			this.resourceBackgroundChanged || this.resourceElementIdsChanged.size > 0;
		const focusChanged =
			this.frameFocusedRegionId !== scene.focusedRegionId ||
			this.frameFocusedRegionMode !== scene.focusedRegionMode;
		this.frameFocusedRegionMode = scene.focusedRegionMode;
		const region = scene.elementsAll.find((element) => element.id === scene.focusedRegionId);
		const focusKey = region ? mapWebglElementGeometryKey(region) : "";
		if (this.frameFocusKey !== focusKey || (!this.frameFocus && region)) {
			const focus = this.buildFocusFrame(scene);
			if (this.frameFocus) this.updateRetainedFrame(this.frameFocus, focus);
			else this.frameFocus = this.retainFrame(focus);
			this.frameFocusKey = focusKey;
		}
		const elementsChanged = new Set(this.resourceElementIdsChanged);
		if (focusChanged) {
			this.interactionTransitions.clear();
			if (this.frameFocusedRegionId) elementsChanged.add(this.frameFocusedRegionId);
			if (scene.focusedRegionId) elementsChanged.add(scene.focusedRegionId);
		}
		if (
			(!elementEditingId || focusChanged) &&
			(this.frameCacheRevision !== scene.contentRevision || resourcesChanged || focusChanged)
		) {
			const frameCurrent = this.frame;
			const structureChanged =
				frameCurrent !== null &&
				(frameCurrent.elementRanges.size !== scene.elements.length ||
					scene.elements.some((element) => !frameCurrent.elementRanges.has(element.id)));
			const canReconcile = focusChanged || structureChanged || elementsChanged.size > 0;
			if (
				canReconcile &&
				frameCurrent &&
				this.reconcileRetainedFrame(frameCurrent, scene, elementsChanged)
			) {
				this.frameCacheRevision = scene.contentRevision;
				this.frameOrderRevision = scene.orderRevision;
			} else this.setFrameCacheRevision(scene.contentRevision);
			this.resourceBackgroundChanged = false;
			this.resourceElementIdsChanged.clear();
			this.frameFocusedRegionId = scene.focusedRegionId;
		}
		if (!this.frame) {
			this.frame = this.retainFrame(this.buildFrame(scene, scene.elements, true, 0));
			this.frameFocusedRegionId = scene.focusedRegionId;
			this.frameOrderRevision = scene.orderRevision;
			this.frameRulerRevision = "";
			this.overlayFrameRevision = "";
			if (import.meta.env.DEV) mapWebglThrowError(this.gl, "frame upload");
		}
		if (this.frameOrderRevision !== scene.orderRevision) {
			if (
				!this.repackRetainedFrame(this.frame, scene.elements) &&
				!this.reconcileRetainedFrame(this.frame, scene)
			) {
				this.deleteRetainedFrame(this.frame);
				this.frame = this.retainFrame(this.buildFrame(scene, scene.elements, true, 0));
			}
			this.frameOrderRevision = scene.orderRevision;
		}
		const elementEditing = elementEditingId
			? scene.elements.find((element) => element.id === elementEditingId)
			: undefined;
		if (
			this.frameEditingRevision !== scene.editingRevision ||
			focusChanged ||
			elementsChanged.has(elementEditingId ?? "")
		) {
			if (elementEditing) {
				const elementRange = this.frame.elementRanges.get(elementEditing.id);
				const frameEditing = this.buildFrame(
					scene,
					[elementEditing],
					false,
					elementRange?.pickIdStart ?? mapWebglPickIdLast(this.frame.pickHits),
					scene.config.elements.length + 1,
				);
				if (this.frameEditing) this.updateRetainedFrame(this.frameEditing, frameEditing);
				else this.frameEditing = this.retainFrame(frameEditing);
			} else if (this.frameEditing) {
				this.deleteRetainedFrame(this.frameEditing);
				this.frameEditing = null;
			}
			this.frameEditingRevision = scene.editingRevision;
			this.frameRulerRevision = "";
			this.overlayFrameRevision = "";
		}
		this.elementEditingId = elementEditingId;
		let frameRuler: MapWebglRetainedFrame | null = null;
		let overlayFrame: MapWebglFrame | null = null;
		if (this.editorOverlayEnabled) {
			const rulerPickIdStart = Math.max(
				mapWebglPickIdLast(this.frame.pickHits),
				this.frameEditing ? mapWebglPickIdLast(this.frameEditing.pickHits) : 0,
			);
			const rulerZoomRatio =
				Math.max(view.zoom, this.frameRulerZoom) /
				Math.max(Math.min(view.zoom, this.frameRulerZoom), 0.0001);
			if (
				!this.frameRuler ||
				this.frameRulerRevision !== scene.rulerRevision ||
				this.frameRulerPickIdStart !== rulerPickIdStart ||
				rulerZoomRatio > 1.35
			) {
				const frameRulerNext = this.buildRulerFrame(scene, rulerPickIdStart);
				if (this.frameRuler) this.updateRetainedFrame(this.frameRuler, frameRulerNext);
				else this.frameRuler = this.retainFrame(frameRulerNext);
				this.frameRulerRevision = scene.rulerRevision;
				this.frameRulerZoom = view.zoom;
				this.frameRulerPickIdStart = rulerPickIdStart;
			}
			frameRuler = this.frameRuler;
			if (!frameRuler) return { imagePresented: Boolean(image.texture), ready: false };
			const overlayPickIdStart = Math.max(
				rulerPickIdStart,
				mapWebglPickIdLast(frameRuler.pickHits),
			);
			const overlayUsesScreenScale =
				Boolean(scene.focusedRegionId) ||
				scene.overlay.rulerPreviewPoints.length > 0 ||
				scene.overlay.draftPreviewPoints.length > 0 ||
				Boolean(scene.overlay.editingElementId);
			const overlayZoomRatio =
				Math.max(view.zoom, this.overlayFrameZoom) /
				Math.max(Math.min(view.zoom, this.overlayFrameZoom), 0.0001);
			if (
				!this.overlayFrame ||
				this.overlayFrameRevision !== scene.overlayRevision ||
				(overlayUsesScreenScale && overlayZoomRatio > 1.35)
			) {
				this.overlayFrame = this.buildOverlayFrame(scene, overlayPickIdStart);
				this.overlayFrameRevision = scene.overlayRevision;
				this.overlayFrameZoom = view.zoom;
				this.uploadOverlayFrame(this.overlayFrame);
			}
			overlayFrame = this.overlayFrame;
		}
		this.drawColorFrame(this.frame, this.frameEditing, frameRuler, overlayFrame, scene);
		this.pickDirty = this.pickingEnabled;
		return { imagePresented: Boolean(image.texture), ready: !image.loading };
	}

	/**
	 * Reads the top hit target at a viewport point.
	 *
	 * @param x - The horizontal point in CSS pixels.
	 * @param y - The vertical point in CSS pixels.
	 * @returns The hit target, or `null` when the point is empty.
	 */
	pick(x: number, y: number): MapWebglHit | null {
		if (!this.pickingEnabled || !this.frame || this.targets.length < 4) return null;
		if (this.pickDirty) {
			this.drawPickFrame(this.frame, this.frameEditing, this.frameRuler, this.overlayFrame);
			this.pickDirty = false;
		}
		const ratio = this.canvas.width / Math.max(this.view.width, 1);
		const pixelX = Math.max(0, Math.min(this.canvas.width - 1, Math.floor(x * ratio)));
		const pixelY = Math.max(
			0,
			Math.min(this.canvas.height - 1, Math.floor((this.view.height - y) * ratio)),
		);
		const pixel = new Uint8Array(4);
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.targets[3]?.framebuffer ?? null);
		this.gl.readPixels(pixelX, pixelY, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel);
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
		const id = pixel[0] + pixel[1] * 256 + pixel[2] * 65_536;
		const hit =
			this.overlayFrame?.pickHits.get(id) ??
			this.frameRuler?.pickHits.get(id) ??
			this.frameEditing?.pickHits.get(id) ??
			this.frame.pickHits.get(id) ??
			null;
		const scene = this.sceneLast;
		if (scene?.focusedRegionId && hit?.kind === "element") {
			const region = scene.elementsAll.find(
				(element) => element.id === scene.focusedRegionId,
			);
			const element = scene.elementsAll.find((element) => element.id === hit.elementId);
			if (
				region?.type === "region" &&
				element?.parentRegionId !== region.id &&
				!mapPointInPolygon(
					{
						x: (x - this.view.panX) / this.view.zoom,
						y: (y - this.view.panY) / this.view.zoom,
					},
					region.points,
				)
			)
				return null;
		}
		return hit;
	}

	/**
	 * Releases all GPU and image resources.
	 *
	 * @returns Nothing.
	 * @sideEffects Deletes resources from the WebGL context.
	 */
	destroy(): void {
		if (this.frameFocus) this.deleteRetainedFrame(this.frameFocus);
		this.frameFocus = null;
		if (this.frameBackground) this.deleteRetainedFrame(this.frameBackground);
		this.frameBackground = null;
		this.destroyed = true;
		this.geometryWorker?.terminate();
		this.geometryWorker = null;
		if (this.interactionFrame) cancelAnimationFrame(this.interactionFrame);
		const gl = this.gl;
		for (const target of this.targets) mapWebglDeleteTarget(gl, target);
		if (this.frame) this.deleteRetainedFrame(this.frame);
		if (this.frameEditing) this.deleteRetainedFrame(this.frameEditing);
		if (this.frameRuler) this.deleteRetainedFrame(this.frameRuler);
		for (const record of this.imageBySource.values()) {
			if (record.texture) gl.deleteTexture(record.texture);
			if (record.owned) record.image.src = "";
		}
		gl.deleteBuffer(this.interactionBuffer);
		gl.deleteBuffer(this.interactionTextureBuffer);
		gl.deleteBuffer(this.overlayShapeBuffer);
		gl.deleteBuffer(this.overlayTextureBuffer);
		gl.deleteBuffer(this.overlayPickBuffer);
		gl.deleteBuffer(this.screenBuffer);
		gl.deleteTexture(this.visibilityTexture);
		for (const program of [
			this.shapeProgram.program,
			this.textureProgram.program,
			this.pickProgram.program,
			this.glowBlurProgram.program,
			this.glowProgram.program,
			this.presentProgram.program,
		])
			gl.deleteProgram(program);
		this.targets = [];
		this.frame = null;
		this.frameEditing = null;
		this.elementEditingId = null;
		this.overlayFrame = null;
		this.meshesByElementId.clear();
		this.interactionTransitions.clear();
		this.sceneLast = null;
	}

	/**
	 * Tests whether the worker cache contains the current mesh for each visible element.
	 *
	 * @param elements - The elements required for the next base frame.
	 * @returns `true` when all required meshes are ready.
	 * @sideEffects Starts one worker request when required geometry is missing.
	 */
	private ensureSceneGeometry(elements: MapElement[]): boolean {
		if (this.geometryWorkerFailed) return true;
		const missing = elements.filter(
			(element) =>
				this.meshesByElementId.get(element.id)?.key !== mapWebglElementGeometryKey(element),
		);
		if (missing.length === 0) return true;
		if (!this.geometryRequestPending) this.startGeometryRequest(missing);
		return false;
	}

	/**
	 * Starts worker preparation for missing visible-label glyphs.
	 *
	 * @param scene - The map scene with visible labels and fitted name layouts.
	 * @returns Nothing.
	 * @sideEffects Starts one worker request when glyph geometry is missing.
	 */
	private prepareSceneGlyphs(scene: MapWebglScene): void {
		if (this.geometryWorkerFailed) return;
		const requirements = new Map<
			string,
			{
				font: MapWebglFont;
				character: string;
				glyph: MapWebglGlyph;
				outlineWidths: Set<number>;
			}
		>();
		const add = (
			fontId: string | undefined,
			text: string,
			fontSize: number,
			borderWidth: number,
		) => {
			const font = this.getFont(fontId, true);
			if (!font.data) return;
			const outlineWidth = fontSize > 0 ? borderWidth / (fontSize / font.data.unitsPerEm) : 0;
			for (const character of text) {
				const characterResolved = mapWebglGlyphCharacter(font.data, character);
				const glyph = font.data.glyphs[characterResolved];
				if (!glyph) continue;
				const key = `${font.id}\u0000${characterResolved}`;
				const requirement = requirements.get(key) ?? {
					font,
					character: characterResolved,
					glyph,
					outlineWidths: new Set<number>(),
				};
				if (outlineWidth > 0) requirement.outlineWidths.add(outlineWidth);
				requirements.set(key, requirement);
			}
		};
		for (const element of scene.elements) {
			const title = mapElementLabelName(element);
			if (!title) continue;
			if (element.type === "symbol" && element.label) {
				const fontSize = element.label.fontSize ?? Math.max(16, element.width * 0.18);
				add(element.label.fontId, title, fontSize, fontSize * 0.12);
				continue;
			}
			if (
				(element.type === "region" || element.type === "area") &&
				element.nameArc &&
				element.nameArc.enabled !== false
			) {
				for (const line of scene.nameLayouts.get(element.id)?.lines ?? []) {
					add(
						element.nameArc.fontId,
						line.text,
						line.fontSize,
						element.nameArc.borderWidth,
					);
				}
				continue;
			}
			if (element.type === "path" && element.label && element.label.enabled !== false) {
				add(
					element.label.fontId,
					title,
					element.label.fontSize ?? 48,
					element.label.borderWidth,
				);
			}
		}
		if (scene.overlay.rulerPaths.length > 0 || scene.overlay.rulerPreviewPoints.length > 1) {
			add(MAP_FONT_DEFAULT_ID, `0123456789,.\u00a0 ${scene.config.scale.unit}`, 14, 2);
		}
		const glyphs: MapWebglGlyphRequest["glyphs"] = [];
		for (const requirement of requirements.values()) {
			const outlineWidths = [...requirement.outlineWidths].filter(
				(width) => !requirement.glyph.outlines?.has(mapWebglOutlineKey(width)),
			);
			if (requirement.glyph.fill && requirement.glyph.contours && outlineWidths.length === 0)
				continue;
			glyphs.push({
				fontId: requirement.font.id,
				character: requirement.character,
				commands: requirement.glyph.commands,
				outlineWidths,
			});
		}
		if (glyphs.length === 0) return;
		if (!this.geometryRequestPending) this.startGlyphRequest(glyphs);
	}

	/**
	 * Starts a worker request for a set of map elements.
	 *
	 * @param elements - The elements that need reusable meshes.
	 * @returns Nothing.
	 * @sideEffects Copies element data to the geometry worker.
	 */
	private startGeometryRequest(elements: MapElement[]): void {
		const worker = this.geometryWorker;
		if (!worker || elements.length === 0) return;
		this.geometryRequestId += 1;
		this.geometryRequestPending = this.geometryRequestId;
		const request: MapWebglGeometryRequest = {
			kind: "elements",
			id: this.geometryRequestId,
			elements: elements.map(mapWebglGeometryElementCopy),
		};
		try {
			worker.postMessage(request);
		} catch {
			this.handleGeometryError();
		}
	}

	/**
	 * Starts a worker request for visible vector-font glyphs.
	 *
	 * @param glyphs - The glyph paths and outline widths to tessellate.
	 * @returns Nothing.
	 * @sideEffects Copies glyph path data to the geometry worker.
	 */
	private startGlyphRequest(glyphs: MapWebglGlyphRequest["glyphs"]): void {
		const worker = this.geometryWorker;
		if (!worker || glyphs.length === 0) return;
		this.geometryRequestId += 1;
		this.geometryRequestPending = this.geometryRequestId;
		const request: MapWebglGlyphRequest = {
			kind: "glyphs",
			id: this.geometryRequestId,
			glyphs,
		};
		try {
			worker.postMessage(request);
		} catch {
			this.handleGeometryError();
		}
	}

	/**
	 * Stores meshes from one completed geometry request.
	 *
	 * @param event - The worker message with transferable mesh arrays.
	 * @returns Nothing.
	 * @sideEffects Changes the mesh cache and requests a map draw.
	 */
	private handleGeometryResult(event: MessageEvent<MapWebglWorkerResult>): void {
		if (this.destroyed || event.data.id !== this.geometryRequestPending) return;
		if (event.data.kind === "elements") {
			for (const result of event.data.meshes) {
				this.meshesByElementId.set(result.elementId, result.value);
			}
		} else {
			for (const result of event.data.glyphs) {
				const font = this.fontsById.get(result.fontId);
				const glyph = font?.data?.glyphs[result.character] ?? font?.data?.glyphs["?"];
				if (!glyph) continue;
				glyph.contours = result.contours;
				glyph.fill = result.fill;
				const outlines = glyph.outlines ?? new Map<string, Float32Array>();
				for (const outline of result.outlines) outlines.set(outline.key, outline.vertices);
				glyph.outlines = outlines;
				if (font) {
					for (const elementId of font.elementIds) {
						this.resourceElementIdsChanged.add(elementId);
					}
				}
			}
			this.frameRulerRevision = "";
			this.overlayFrameRevision = "";
		}
		this.geometryRequestPending = 0;
		this.visibilityRevision = "";
		this.invalidate();
	}

	/**
	 * Changes the renderer to synchronous geometry after a worker error.
	 *
	 * @returns Nothing.
	 * @sideEffects Stops the worker, reports the error, and requests a map draw.
	 */
	private handleGeometryError(): void {
		if (this.destroyed || this.geometryWorkerFailed) return;
		this.geometryWorkerFailed = true;
		this.geometryRequestPending = 0;
		this.geometryWorker?.terminate();
		this.geometryWorker = null;
		for (const font of this.fontsById.values()) {
			for (const elementId of font.elementIds) this.resourceElementIdsChanged.add(elementId);
		}
		this.frameRulerRevision = "";
		this.overlayFrameRevision = "";
		this.reportError(new Error("The map geometry worker stopped."));
		this.invalidate();
	}

	/**
	 * Sends a small inactive-element batch to the geometry worker.
	 *
	 * @param elements - All configured elements in paint order.
	 * @returns Nothing.
	 * @sideEffects Starts one worker request after the visible frame is ready.
	 */
	private warmSceneGeometry(elements: MapElement[]): void {
		if (this.geometryWorkerFailed || this.geometryRequestPending) return;
		const missing = elements
			.filter(
				(element) =>
					this.meshesByElementId.get(element.id)?.key !==
					mapWebglElementGeometryKey(element),
			)
			.slice(0, 4);
		this.startGeometryRequest(missing);
	}

	/**
	 * Recreates framebuffer textures for a new canvas size.
	 *
	 * @param width - The drawing-buffer width.
	 * @param height - The drawing-buffer height.
	 * @returns Nothing.
	 * @sideEffects Replaces the renderer framebuffer targets.
	 */
	private resizeTargets(width: number, height: number): void {
		if (width === this.targetWidth && height === this.targetHeight) return;
		for (const target of this.targets) mapWebglDeleteTarget(this.gl, target);
		const targetCount = this.pickingEnabled ? 4 : this.interactionEnabled ? 3 : 0;
		this.targets = Array.from({ length: targetCount }, () =>
			mapWebglCreateTarget(this.gl, width, height),
		);
		this.targetWidth = width;
		this.targetHeight = height;
	}

	/**
	 * Converts a scene into ordered GPU commands.
	 *
	 * @param scene - The current map scene.
	 * @param elements - The elements to include.
	 * @param includeImage - Whether to include the map image.
	 * @param pickIdStart - The first available picking identifier.
	 * @returns The command and vertex buffers for one frame.
	 */
	private buildFrame(
		scene: MapWebglScene,
		elements: MapElement[],
		includeImage: boolean,
		pickIdStart: number,
		visibilityIndexOverride?: number,
	): MapWebglFrame {
		const builder = this.createFrameBuilder(scene, false, pickIdStart);

		for (const element of elements) {
			mapWebglFlushShapeCommand(builder);
			const shapeOffset = builder.shapeVertices.length;
			const textureOffset = builder.textureVertices.length;
			const pickOffset = builder.pickVertices.length;
			const elementPickIdStart = builder.pickId;
			const commandOffset = builder.commands.length;
			builder.elementId = element.id;
			builder.visibilityIndex =
				visibilityIndexOverride ?? this.visibilityIndexes.get(element.id) ?? 0;
			this.addElement(builder, scene, element);
			mapWebglFlushShapeCommand(builder);
			builder.elementRanges.set(element.id, {
				shapeOffset,
				shapeLength: builder.shapeVertices.length - shapeOffset,
				textureOffset,
				textureLength: builder.textureVertices.length - textureOffset,
				pickOffset,
				pickLength: builder.pickVertices.length - pickOffset,
				pickIdStart: elementPickIdStart,
				pickIdEnd: builder.pickId,
				commands: builder.commands.slice(commandOffset).map(mapWebglCloneCommand),
			});
		}
		builder.elementId = undefined;
		builder.visibilityIndex = 0;

		builder.elementId = undefined;
		return mapWebglFinishFrame(builder);
	}

	/**
	 * Builds the dim area outside the focused region.
	 * @param scene - The current map scene.
	 * @returns The focus frame without object geometry.
	 */
	private buildFocusFrame(scene: MapWebglScene): MapWebglFrame {
		const builder = this.createFrameBuilder(scene, false, 0);
		const focusedRegion = scene.focusedRegionId
			? scene.elementsAll.find(
					(element): element is MapElementRegion =>
						element.id === scene.focusedRegionId && element.type === "region",
				)
			: null;
		const focusMask = focusedRegion
			? (() => {
					const outline = mapWebglPathSegments(
						focusedRegion.points,
						true,
						focusedRegion.smoothing,
					).flatMap((segment, index) =>
						index === 0 ? segment.points : segment.points.slice(1),
					);
					return mapWebglCompoundFillMesh([
						[
							{ x: 0, y: 0 },
							{ x: scene.config.image.width, y: 0 },
							{ x: scene.config.image.width, y: scene.config.image.height },
							{ x: 0, y: scene.config.image.height },
						],
						outline,
					]);
				})()
			: null;

		if (focusMask) {
			mapWebglAddShapeMesh(
				builder,
				focusMask,
				{
					borderColor: "#000000",
					borderOpacity: 0,
					borderWidth: 0,
					fillColor: "#000000",
					fillOpacity: 0.58,
				},
				false,
			);
		}
		return mapWebglFinishFrame(builder);
	}

	/**
	 * Starts a retained frame builder.
	 *
	 * @param scene - The current map scene.
	 * @param includeImage - Whether to include the map image.
	 * @param pickIdStart - The first available picking identifier.
	 * @returns A new frame builder.
	 * @sideEffects Gets or starts the map-image texture when requested.
	 */
	private createFrameBuilder(
		scene: MapWebglScene,
		includeImage: boolean,
		pickIdStart: number,
	): MapWebglFrameBuilder {
		const builder: MapWebglFrameBuilder = {
			commands: [],
			shapeVertices: [],
			textureVertices: [],
			pickVertices: [],
			pickHits: new Map(),
			pickId: pickIdStart,
			pickingEnabled: this.pickingEnabled,
			shapeStart: null,
			visibilityIndex: 0,
			elementRanges: new Map(),
		};
		const image = includeImage
			? this.getImage(scene.imageSource, scene.imageElement, true, true, undefined, true)
			: null;
		if (image?.texture) {
			mapWebglAddTextureCommand(
				builder,
				mapWebglRectangleMesh(
					{ x: scene.config.image.width / 2, y: scene.config.image.height / 2 },
					scene.config.image.width,
					scene.config.image.height,
				).vertices,
				image.texture,
			);
		}
		for (const tile of includeImage ? (scene.imageTiles ?? []) : []) {
			const tileImage = this.getImage(tile.source, undefined, true, true, undefined, true);
			if (!tileImage.texture) continue;
			mapWebglAddTextureCommand(
				builder,
				mapWebglRectangleMesh(
					{ x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 },
					tile.width,
					tile.height,
				).vertices,
				tileImage.texture,
			);
		}

		return builder;
	}

	/**
	 * Converts completed rulers into a retained frame.
	 *
	 * @param scene - The current map scene.
	 * @param pickIdStart - The first free picking identifier.
	 * @returns The ruler command and vertex buffers.
	 */
	private buildRulerFrame(scene: MapWebglScene, pickIdStart: number): MapWebglFrame {
		const builder: MapWebglFrameBuilder = {
			commands: [],
			shapeVertices: [],
			textureVertices: [],
			pickVertices: [],
			pickHits: new Map(),
			pickId: pickIdStart,
			pickingEnabled: this.pickingEnabled,
			shapeStart: null,
			visibilityIndex: 0,
			elementRanges: new Map(),
		};
		this.addRulers(builder, scene);
		mapWebglFlushShapeCommand(builder);
		return {
			commands: builder.commands,
			shapeVertices: new Float32Array(builder.shapeVertices),
			textureVertices: new Float32Array(builder.textureVertices),
			pickVertices: new Float32Array(builder.pickVertices),
			pickHits: builder.pickHits,
			elementRanges: builder.elementRanges,
		};
	}

	/**
	 * Converts transient tools and editor controls into a small retained frame.
	 *
	 * @param scene - The current map scene.
	 * @param pickIdStart - The first free picking identifier.
	 * @returns The overlay command and vertex buffers.
	 */
	private buildOverlayFrame(scene: MapWebglScene, pickIdStart: number): MapWebglFrame {
		const builder: MapWebglFrameBuilder = {
			commands: [],
			shapeVertices: [],
			textureVertices: [],
			pickVertices: [],
			pickHits: new Map(),
			pickId: pickIdStart,
			pickingEnabled: this.pickingEnabled,
			shapeStart: null,
			visibilityIndex: 0,
			elementRanges: new Map(),
		};
		this.addOverlay(builder, scene);
		mapWebglFlushShapeCommand(builder);
		return {
			commands: builder.commands,
			shapeVertices: new Float32Array(builder.shapeVertices),
			textureVertices: new Float32Array(builder.textureVertices),
			pickVertices: new Float32Array(builder.pickVertices),
			pickHits: builder.pickHits,
			elementRanges: builder.elementRanges,
		};
	}

	/**
	 * Adds one configured element to a frame.
	 *
	 * @param builder - The frame builder.
	 * @param scene - The current map scene.
	 * @param element - The element to add.
	 * @returns Nothing.
	 * @sideEffects Adds render and picking data to `builder`.
	 */
	private addElement(
		builder: MapWebglFrameBuilder,
		scene: MapWebglScene,
		element: MapElement,
	): void {
		const pickingEnabled = builder.pickingEnabled;
		builder.pickingEnabled =
			pickingEnabled &&
			(!scene.interactiveElementIds || scene.interactiveElementIds.has(element.id)) &&
			!(element.type === "grid" && scene.overlay.editingElementId === element.id);
		if (element.type === "symbol") {
			const recipe = mapElementTacticalRecipe(element);
			if (recipe) {
				const meshes = this.getElementMeshes(element);
				const unitUsesSvg = [
					...scene.config.military.roles,
					...scene.config.military.echelons,
				].some(
					(item) =>
						(item.id === recipe.parameters.role ||
							item.id === recipe.parameters.echelon) &&
						item.assetUid &&
						scene.symbolSources.has(item.assetUid),
				);
				if (!unitUsesSvg) {
					if (meshes.stroke)
						mapWebglAddShapeMesh(builder, meshes.stroke, recipe.style, true);
					if (meshes.fill)
						mapWebglAddShapeMesh(builder, meshes.fill, recipe.style, false);
				}
				this.addTacticalUnitSymbols(builder, scene, recipe);
				this.addSymbol(builder, element, undefined, { key: meshes.key, pick: meshes.pick });
			} else
				this.addSymbol(
					builder,
					element,
					scene.symbolSources.get(element.assetUid),
					this.getElementMeshes(element),
				);
		} else if (element.type === "grid") {
			const parent = scene.elementsAll.find(
				(entry): entry is MapElementRegion =>
					entry.id === element.parentRegionId && entry.type === "region",
			);
			const maskPolygon = parent
				? mapWebglPathSegments(parent.points, true, parent.smoothing).flatMap(
						(segment, index) =>
							index === 0 ? segment.points : segment.points.slice(1),
					)
				: [];
			const meshes = parent
				? mapWebglGridElementMeshes(element, maskPolygon)
				: this.getElementMeshes(element);
			if (meshes.stroke) mapWebglAddShapeMesh(builder, meshes.stroke, element.style, true);
			mapWebglAddPickMesh(builder, meshes.pick, {
				kind: "element",
				elementId: element.id,
			});
		} else if (element.type === "area") {
			this.addArea(builder, element, this.getElementMeshes(element));
		} else {
			const meshes = this.getElementMeshes(element);
			if (element.type === "region") {
				const fill = meshes.fill;
				if (!fill) {
					builder.pickingEnabled = pickingEnabled;
					return;
				}
				const display = mapRegionFocusDisplay(
					this.regionCompositeIds.has(element.id),
					scene.focusedRegionId === element.id,
					scene.focusedRegionMode,
				);
				if (display.fillVisible)
					mapWebglAddShapeMesh(builder, fill, element.style, false, display.checkered);
				const stroke =
					display.borderScale > 1
						? mapWebglStrokeMesh(
								mapWebglPathSegments(element.points, true, element.smoothing),
								element.style.borderWidth * display.borderScale,
								element.waterEdges,
							)
						: meshes.stroke;
				if (stroke) mapWebglAddShapeMesh(builder, stroke, element.style, true);
				mapWebglAddPickMesh(builder, !display.fillVisible ? (stroke ?? fill) : fill, {
					kind: "element",
					elementId: element.id,
				});
			} else if (element.type === "tactical") {
				const unitUsesSvg =
					element.kind === "unit" &&
					[
						scene.config.military.roles.find(
							(item) => item.id === String(element.parameters.role ?? ""),
						)?.assetUid,
						scene.config.military.echelons.find(
							(item) => item.id === String(element.parameters.echelon ?? ""),
						)?.assetUid,
					].some((assetUid) => assetUid && scene.symbolSources.has(assetUid));
				if (!unitUsesSvg && meshes.stroke)
					mapWebglAddShapeMesh(builder, meshes.stroke, element.style, true);
				if (!unitUsesSvg && meshes.fill)
					mapWebglAddShapeMesh(builder, meshes.fill, element.style, false);
				if (element.kind === "unit") this.addTacticalUnitSymbols(builder, scene, element);
				mapWebglAddPickMesh(builder, meshes.pick, {
					kind: "element",
					elementId: element.id,
				});
			} else {
				if (meshes.stroke)
					mapWebglAddShapeMesh(builder, meshes.stroke, element.style, true);
				if (meshes.fill) mapWebglAddShapeMesh(builder, meshes.fill, element.style, false);
				mapWebglAddPickMesh(builder, meshes.pick, {
					kind: "element",
					elementId: element.id,
				});
			}
		}
		const layout = scene.nameLayouts.get(element.id);
		if (
			layout &&
			mapRegionFocusDisplay(
				this.regionCompositeIds.has(element.id),
				scene.focusedRegionId === element.id,
				scene.focusedRegionMode,
			).labelVisible &&
			(element.type === "region" || element.type === "area") &&
			element.nameArc &&
			element.nameArc.enabled !== false
		) {
			this.addArcLayout(builder, layout, element.nameArc);
		}
		if (
			element.type === "path" &&
			element.label &&
			element.label.enabled !== false &&
			mapElementLabelName(element)
		) {
			this.addPathLabel(builder, element, mapElementLabelName(element));
		}
		builder.pickingEnabled = pickingEnabled;
	}

	/**
	 * Adds configured role and echelon SVGs to one unit designation.
	 *
	 * @param builder - The frame builder.
	 * @param scene - The current map scene.
	 * @param element - The unit designation.
	 * @returns Nothing.
	 * @sideEffects Loads image textures and adds texture commands to `builder`.
	 */
	private addTacticalUnitSymbols(
		builder: MapWebglFrameBuilder,
		scene: MapWebglScene,
		element: MapElementTactical,
	): void {
		const center = element.points[0] ?? { x: 0, y: 0 };
		const sizeValue = element.parameters.size;
		const rotationValue = element.parameters.rotation;
		const size = typeof sizeValue === "number" ? sizeValue : 56;
		const rotation = typeof rotationValue === "number" ? rotationValue : 0;
		const roleId = String(element.parameters.role ?? "");
		const echelonId = String(element.parameters.echelon ?? "");
		const roleUid = scene.config.military.roles.find((item) => item.id === roleId)?.assetUid;
		const echelonUid = scene.config.military.echelons.find(
			(item) => item.id === echelonId,
		)?.assetUid;
		for (const assetUid of [roleUid, echelonUid]) {
			if (!assetUid) continue;
			const source = scene.symbolSources.get(assetUid);
			if (!source) continue;
			const image = this.getImage(source, undefined, true, true, element.id);
			if (!image.texture) continue;
			const widthNatural = image.image.naturalWidth;
			const heightNatural = image.image.naturalHeight;
			const extentNatural = Math.max(1, widthNatural, heightNatural);
			const mesh = mapWebglRectangleMesh(
				center,
				(widthNatural / extentNatural) * size,
				((heightNatural / extentNatural) *
					(Number(element.parameters.height) || size * 0.68)) /
					0.68,
				rotation,
			);
			mapWebglAddTextureCommand(builder, mesh.vertices, image.texture);
		}
	}

	/**
	 * Adds one circle element to a frame.
	 *
	 * @param builder - The frame builder.
	 * @param element - The circle element.
	 * @returns Nothing.
	 * @sideEffects Adds render and picking data to `builder`.
	 */
	private addArea(
		builder: MapWebglFrameBuilder,
		element: MapElementArea,
		meshes: MapWebglElementMeshes,
	): void {
		const fill = meshes.fill;
		if (!fill) return;
		mapWebglAddShapeMesh(builder, fill, element.style, false);
		if (meshes.stroke) mapWebglAddShapeMesh(builder, meshes.stroke, element.style, true);
		mapWebglAddPickMesh(builder, fill, { kind: "element", elementId: element.id });
	}

	/**
	 * Adds one image symbol to a frame.
	 *
	 * @param builder - The frame builder.
	 * @param element - The symbol element.
	 * @param source - The symbol image URL.
	 * @param meshes - The cached symbol meshes.
	 * @returns Nothing.
	 * @sideEffects Adds render and picking data to `builder`.
	 */
	private addSymbol(
		builder: MapWebglFrameBuilder,
		element: MapElementSymbol,
		source?: string,
		meshes?: MapWebglElementMeshes,
	): void {
		const meshPick =
			meshes?.pick ??
			mapWebglRectangleMesh(element.center, element.width, element.height, element.rotation);
		if (source) {
			const image = this.getImage(source, undefined, true, true, element.id);
			if (image.texture) {
				const meshTexture = mapWebglRectangleMesh(
					element.center,
					element.width,
					element.height,
					element.rotation,
				);
				mapWebglAddTextureCommand(
					builder,
					meshTexture.vertices,
					image.texture,
					element.shape === "circle",
				);
			}
		}
		if (meshes?.stroke && element.style) {
			mapWebglAddShapeMesh(builder, meshes.stroke, element.style, true);
		}
		mapWebglAddPickMesh(builder, meshPick, { kind: "element", elementId: element.id });
		const title = mapElementLabelName(element);
		if (!element.label || !title) return;
		const fontSize = element.label.fontSize ?? Math.max(16, element.width * 0.18);
		const lines = title
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		for (const [index, line] of lines.entries()) {
			const baseline =
				element.center.y +
				element.height / 2 +
				Math.max(12, element.height * 0.08) +
				(index + 1) * fontSize * 1.2;
			this.addStraightText(
				builder,
				line,
				{ x: element.center.x, y: baseline },
				fontSize,
				[0.1, 0.1, 0.1, 1],
				[0.95, 0.95, 0.95, 1],
				fontSize * 0.12,
				element.label.fontId,
				element.label.autoscale ? "clamp" : "map",
				{ x: element.center.x, y: element.center.y + element.height / 2 },
			);
		}
	}

	/**
	 * Gets cached geometry for one configured element.
	 *
	 * @param element - The element to measure and tessellate.
	 * @returns The current fill, stroke, and picking meshes.
	 * @sideEffects Replaces the cache entry when geometry changes.
	 */
	private getElementMeshes(element: MapElement): MapWebglElementMeshes {
		const key = mapWebglElementGeometryKey(element);
		const current = this.meshesByElementId.get(element.id);
		if (current?.key === key) return current;
		const meshes = mapWebglElementMeshes(element);
		this.meshesByElementId.set(element.id, meshes);
		return meshes;
	}

	/**
	 * Adds one curved label layout to a frame.
	 *
	 * @param builder - The frame builder.
	 * @param layout - The curved label layout.
	 * @param style - The curved label style.
	 * @returns Nothing.
	 * @sideEffects Adds text commands to `builder`.
	 */
	private addArcLayout(
		builder: MapWebglFrameBuilder,
		layout: MapNameArcLayout,
		style: NonNullable<MapElementRegion["nameArc"] | MapElementPath["label"]>,
	): void {
		for (const line of layout.lines) {
			this.addCurvedText(
				builder,
				line,
				style.fontId,
				mapWebglColor(style.fillColor, style.fillOpacity),
				mapWebglColor(style.borderColor, style.borderOpacity),
				style.borderWidth,
			);
		}
	}

	/**
	 * Adds a straight or curved label to one path.
	 *
	 * @param builder - The frame builder.
	 * @param element - The path with label settings.
	 * @param title - The visible label text.
	 * @returns Nothing.
	 * @sideEffects Adds text commands to `builder`.
	 */
	private addPathLabel(
		builder: MapWebglFrameBuilder,
		element: MapElementPath,
		title: string,
	): void {
		const label = element.label;
		if (!label) return;
		const points = mapWebglPathSegments(element.points, false, element.smoothing).flatMap(
			(segment) => segment.points,
		);
		const position = label.position ?? 50;
		if (label.mode === "arc") {
			const layout = mapPathLabelArcLayout(points, title, label.fontSize ?? 48, position);
			if (layout) this.addArcLayout(builder, layout, label);
			return;
		}
		const sample = mapPathLabelSample(points, position);
		if (!sample) return;
		let tangent = sample.tangent;
		if (tangent.x < 0 || (Math.abs(tangent.x) < 1e-4 && tangent.y > 0))
			tangent = { x: -tangent.x, y: -tangent.y };
		const fontSize = label.fontSize ?? 48;
		const lines = mapNameArcLines(title);
		const normal = { x: -tangent.y, y: tangent.x };
		const rotation = Math.atan2(tangent.y, tangent.x);
		for (const [index, text] of lines.entries()) {
			const shift = (index - (lines.length - 1) / 2) * fontSize * 1.2;
			const center = {
				x: sample.point.x + normal.x * shift,
				y: sample.point.y + normal.y * shift,
			};
			this.addStraightText(
				builder,
				text,
				center,
				fontSize,
				mapWebglColor(label.fillColor, label.fillOpacity),
				mapWebglColor(label.borderColor, label.borderOpacity),
				label.borderWidth,
				label.fontId,
				"map",
				center,
				rotation,
			);
		}
	}

	/**
	 * Adds text along a quadratic curve.
	 *
	 * @param builder - The frame builder.
	 * @param line - The curve and text data.
	 * @param fontId - The configured font identifier.
	 * @param fillColor - The text color.
	 * @param borderColor - The border color.
	 * @param borderWidth - The border width in map units.
	 * @returns Nothing.
	 * @sideEffects Adds one text command to `builder`.
	 */
	private addCurvedText(
		builder: MapWebglFrameBuilder,
		line: MapNameArcLine,
		fontId: string | undefined,
		fillColor: [number, number, number, number],
		borderColor: [number, number, number, number],
		borderWidth: number,
	): void {
		const font = this.getFont(fontId, true, builder.elementId);
		if (!font.data) return;
		const characters = [...line.text];
		const glyphs = characters.map((character) => this.getGlyph(font, character));
		const fontScale = line.fontSize / font.data.unitsPerEm;
		let textWidth = 0;
		for (const [index, glyph] of glyphs.entries()) {
			if (!glyph) continue;
			const previous = characters[index - 1];
			const character = characters[index];
			const kerning =
				previous && character
					? (font.data.kerning[String(previous.codePointAt(0))]?.[
							String(character.codePointAt(0))
						] ?? 0)
					: 0;
			textWidth += (glyph.advance + kerning) * fontScale;
		}
		const curveLength = mapWebglNameCurveLength(line);
		let distance = Math.max((curveLength - textWidth) / 2, 0);
		const verticesBorder: number[] = [];
		const verticesFill: number[] = [];
		for (const [index, glyph] of glyphs.entries()) {
			if (!glyph) continue;
			const previous = characters[index - 1];
			const character = characters[index];
			const kerning =
				previous && character
					? (font.data.kerning[String(previous.codePointAt(0))]?.[
							String(character.codePointAt(0))
						] ?? 0) * fontScale
					: 0;
			distance += kerning;
			const advance = glyph.advance * fontScale;
			const sample = mapWebglNameCurveSample(line, (distance + advance / 2) / curveLength);
			const angle = Math.atan2(sample.tangent.y, sample.tangent.x);
			mapWebglAddGlyphGeometry(
				verticesBorder,
				verticesFill,
				glyph,
				sample.point,
				fontScale,
				angle,
				-advance / 2,
				borderWidth,
				fillColor,
				borderColor,
				builder.visibilityIndex,
			);
			distance += advance;
		}
		mapWebglAddVectorTextCommand(builder, verticesBorder, verticesFill);
	}

	/**
	 * Adds one centered line of text.
	 *
	 * @param builder - The frame builder.
	 * @param text - The text to draw.
	 * @param center - The baseline center in map units.
	 * @param fontSize - The font size in map units.
	 * @param fillColor - The text color.
	 * @param borderColor - The border color.
	 * @param borderWidth - The border width in map units.
	 * @param fontId - The configured font identifier.
	 * @param scaleMode - The zoom scaling behavior.
	 * @param anchor - The screen-scale anchor.
	 * @param rotation - The clockwise baseline rotation in radians.
	 * @returns Nothing.
	 * @sideEffects Adds one text command to `builder`.
	 */
	private addStraightText(
		builder: MapWebglFrameBuilder,
		text: string,
		center: MapPoint,
		fontSize: number,
		fillColor: [number, number, number, number],
		borderColor: [number, number, number, number],
		borderWidth: number,
		fontId = MAP_FONT_DEFAULT_ID,
		scaleMode: MapWebglVectorTextCommand["scaleMode"] = "map",
		anchor = center,
		rotation = 0,
	): void {
		const font = this.getFont(fontId, true, builder.elementId);
		if (!font.data) return;
		const characters = [...text];
		const glyphs = characters.map((character) => this.getGlyph(font, character));
		const fontScale = fontSize / font.data.unitsPerEm;
		let width = 0;
		for (const [index, glyph] of glyphs.entries()) {
			if (!glyph) continue;
			const previous = characters[index - 1];
			const character = characters[index];
			const kerning =
				previous && character
					? (font.data.kerning[String(previous.codePointAt(0))]?.[
							String(character.codePointAt(0))
						] ?? 0)
					: 0;
			width += (glyph.advance + kerning) * fontScale;
		}
		let x = center.x - width / 2;
		const verticesBorder: number[] = [];
		const verticesFill: number[] = [];
		for (const [index, glyph] of glyphs.entries()) {
			if (!glyph) continue;
			const previous = characters[index - 1];
			const character = characters[index];
			if (previous && character) {
				x +=
					(font.data.kerning[String(previous.codePointAt(0))]?.[
						String(character.codePointAt(0))
					] ?? 0) * fontScale;
			}
			mapWebglAddGlyphGeometry(
				verticesBorder,
				verticesFill,
				glyph,
				center,
				fontScale,
				rotation,
				x - center.x,
				borderWidth,
				fillColor,
				borderColor,
				builder.visibilityIndex,
			);
			x += glyph.advance * fontScale;
		}
		mapWebglAddVectorTextCommand(builder, verticesBorder, verticesFill, anchor, scaleMode);
	}

	/**
	 * Adds completed rulers to a retained frame.
	 *
	 * @param builder - The frame builder.
	 * @param scene - The current map scene.
	 * @returns Nothing.
	 * @sideEffects Adds ruler render and picking data to `builder`.
	 */
	private addRulers(builder: MapWebglFrameBuilder, scene: MapWebglScene): void {
		const overlayStyle = mapWebglSolidStyle("#ffffff", 1);
		const selectedStyle = mapWebglSolidStyle("#d9b45b", 1);
		for (const ruler of scene.overlay.rulerPaths) {
			const segments = mapWebglPathSegments(ruler.points, false, 0);
			mapWebglAddShapeMesh(
				builder,
				mapWebglStrokeMesh(segments, 3 / this.view.zoom),
				ruler.id === scene.overlay.rulerSelectedId ||
					ruler.id === scene.overlay.rulerHoverId
					? selectedStyle
					: overlayStyle,
				true,
			);
			mapWebglAddPickMesh(builder, mapWebglStrokeMesh(segments, 18 / this.view.zoom), {
				kind: "ruler",
				rulerId: ruler.id,
			});
			for (const [index, point] of ruler.points.entries()) {
				this.addPointHandle(builder, point, "#d9b45b", false);
				mapWebglAddPickMesh(builder, mapWebglCircleMesh(point, 10 / this.view.zoom, 24), {
					kind: "rulerPoint",
					rulerId: ruler.id,
					index,
				});
			}
			const end = ruler.points.at(-1);
			if (end) {
				this.addStraightText(
					builder,
					mapRulerDistanceText(scene, ruler.points),
					{
						x:
							end.x > scene.config.image.width - 120 / this.view.zoom
								? end.x - 48
								: end.x + 48,
						y: end.y - 12,
					},
					14,
					[1, 1, 1, 1],
					[0.05, 0.05, 0.05, 1],
					2,
					MAP_FONT_DEFAULT_ID,
					"screen",
					end,
				);
			}
		}
	}

	/**
	 * Adds active tools and editing controls to a frame.
	 *
	 * @param builder - The frame builder.
	 * @param scene - The current map scene.
	 * @returns Nothing.
	 * @sideEffects Adds overlay render and picking data to `builder`.
	 */
	private addOverlay(builder: MapWebglFrameBuilder, scene: MapWebglScene): void {
		const overlayStyle = mapWebglSolidStyle("#ffffff", 1);
		const region = scene.elementsAll.find((element) => element.id === scene.focusedRegionId);
		if (region?.type === "region") {
			const border = mapWebglPathSegments(region.points, true, region.smoothing).flatMap(
				(segment) => segment.points,
			);
			for (const child of scene.elementsAll) {
				if (child.parentRegionId !== region.id) continue;
				const mesh = this.getElementMeshes(child).pick;
				let outside = false;
				for (let index = 0; index < mesh.vertices.length; index += 2) {
					if (
						!mapPointInPolygon(
							{ x: mesh.vertices[index]!, y: mesh.vertices[index + 1]! },
							border,
						)
					) {
						outside = true;
						break;
					}
				}
				if (!outside) continue;
				const { minX, minY, maxX, maxY } = mesh.bounds;
				const outline = mapWebglStrokeMesh(
					mapWebglPathSegments(
						[
							{ x: minX, y: minY },
							{ x: maxX, y: minY },
							{ x: maxX, y: maxY },
							{ x: minX, y: maxY },
						],
						true,
						0,
					),
					3 / this.view.zoom,
				);
				mapWebglAddShapeMesh(builder, outline, mapWebglSolidStyle("#ef4444", 1), false);
				mapWebglAddPickMesh(builder, outline, { kind: "element", elementId: child.id });
			}
		}
		const symbolPreview = scene.overlay.symbolPreview;
		if (symbolPreview) {
			const pickingEnabled = builder.pickingEnabled;
			builder.pickingEnabled = false;
			this.addSymbol(
				builder,
				symbolPreview,
				scene.symbolSources.get(symbolPreview.assetUid),
				this.getElementMeshes(symbolPreview),
			);
			builder.pickingEnabled = pickingEnabled;
		}
		if (scene.overlay.rulerPreviewPoints.length > 0) {
			mapWebglAddShapeMesh(
				builder,
				mapWebglStrokeMesh(
					mapWebglPathSegments(scene.overlay.rulerPreviewPoints, false, 0),
					3 / this.view.zoom,
				),
				overlayStyle,
				true,
			);
			const pointIndexLast = scene.overlay.rulerActivePoints.length - 1;
			for (const [index, point] of scene.overlay.rulerActivePoints.entries()) {
				const end = index === pointIndexLast && index > 0;
				const color = index === 0 ? "#48a868" : end ? "#c94848" : "#d9b45b";
				this.addPointHandle(
					builder,
					point,
					color,
					end && scene.overlay.rulerFinishHovered,
					end ? 12 : 9,
				);
				if (end) {
					mapWebglAddPickMesh(
						builder,
						mapWebglCircleMesh(point, 22 / this.view.zoom, 24),
						{
							kind: "finishRuler",
						},
					);
				}
			}
			const previewEnd = scene.overlay.rulerPreviewPoints.at(-1);
			if (previewEnd && scene.overlay.rulerPreviewPoints.length > 1) {
				this.addStraightText(
					builder,
					mapRulerDistanceText(scene, scene.overlay.rulerPreviewPoints),
					{
						x:
							previewEnd.x > scene.config.image.width - 120 / this.view.zoom
								? previewEnd.x - 48
								: previewEnd.x + 48,
						y: previewEnd.y - 12,
					},
					14,
					[1, 1, 1, 1],
					[0.05, 0.05, 0.05, 1],
					2,
					MAP_FONT_DEFAULT_ID,
					"screen",
					previewEnd,
				);
			}
		}
		if (scene.overlay.draftPreviewPoints.length > 0) {
			mapWebglAddShapeMesh(
				builder,
				mapWebglStrokeMesh(
					mapWebglPathSegments(scene.overlay.draftPreviewPoints, false, 0),
					3 / this.view.zoom,
				),
				overlayStyle,
				true,
			);
			const first = scene.overlay.draftPoints[0];
			if (first && scene.overlay.draftType === "region") {
				const mesh = mapWebglCircleMesh(first, 11 / this.view.zoom, 24);
				mapWebglAddShapeMesh(builder, mesh, overlayStyle, false);
				mapWebglAddPickMesh(builder, mesh, { kind: "finishRegion" });
			}
		}
		const editing = scene.elements.find(
			(element) => element.id === scene.overlay.editingElementId,
		);
		this.editHoverKey = scene.overlay.editHoverKey;
		if (editing) this.addEditingControls(builder, editing, scene.overlay.selectedPointIndexes);
		this.editHoverKey = null;
	}

	/**
	 * Adds controls for one edited element.
	 *
	 * @param builder - The frame builder.
	 * @param element - The edited element.
	 * @param selectedIndexes - The selected control-point indexes.
	 * @returns Nothing.
	 * @sideEffects Adds editor render and picking data to `builder`.
	 */
	private addEditingControls(
		builder: MapWebglFrameBuilder,
		element: MapElement,
		selectedIndexes: number[],
	): void {
		if (element.type === "area") {
			this.addEditHandle(builder, element.id, "center", 0, element.center, "#d9b45b");
			this.addEditHandle(
				builder,
				element.id,
				"radius",
				0,
				{ x: element.center.x + element.radius, y: element.center.y },
				"#48a868",
			);
			return;
		}
		if (element.type === "symbol" || element.type === "grid") {
			this.addEditHandle(builder, element.id, "center", 0, element.center, "#d9b45b");
			const angle = (element.rotation * Math.PI) / 180;
			const corner = mapWebglRotatedPoint(
				element.center,
				element.width / 2,
				element.height / 2,
				angle,
			);
			const rotation = mapWebglRotatedPoint(
				element.center,
				0,
				-element.height / 2 - 40 / this.view.zoom,
				angle,
			);
			this.addEditHandle(builder, element.id, "size", 0, corner, "#48a868");
			this.addEditHandle(builder, element.id, "rotation", 0, rotation, "#c94848");
			return;
		}
		if (element.type === "tactical" && element.kind === "unit") {
			const center = element.points[0];
			if (center) {
				const sizeValue = element.parameters.size;
				const rotationValue = element.parameters.rotation;
				const size = typeof sizeValue === "number" ? sizeValue : 56;
				const rotation = typeof rotationValue === "number" ? rotationValue : 0;
				const angle = (rotation * Math.PI) / 180;
				this.addEditHandle(
					builder,
					element.id,
					"rotation",
					0,
					mapWebglRotatedPoint(center, 0, -size * 0.34 - 40 / this.view.zoom, angle),
					"#c94848",
				);
			}
		}
		if (
			element.type === "region" &&
			element.nameArc?.enabled !== false &&
			element.nameArc?.anchor &&
			mapRegionFocusDisplay(
				this.regionCompositeIds.has(element.id),
				this.sceneLast?.focusedRegionId === element.id,
				this.sceneLast?.focusedRegionMode,
			).labelVisible
		) {
			this.addEditHandle(builder, element.id, "name", 0, element.nameArc.anchor, "#3d7fc4");
			const radians = ((element.nameArc.rotation ?? 0) * Math.PI) / 180;
			this.addEditHandle(
				builder,
				element.id,
				"nameRotation",
				0,
				{
					x: element.nameArc.anchor.x + (Math.sin(radians) * 60) / this.view.zoom,
					y: element.nameArc.anchor.y - (Math.cos(radians) * 60) / this.view.zoom,
				},
				"#c94848",
			);
		}
		const segmentCount =
			element.type === "region" ? element.points.length : element.points.length - 1;
		for (let index = 0; index < segmentCount; index += 1) {
			const start = element.points[index];
			const end = element.points[(index + 1) % element.points.length];
			if (start && end)
				this.addEditHandle(
					builder,
					element.id,
					"insert",
					index,
					mapPointMidpoint(start, end),
					"#ffffff",
					7,
				);
		}
		for (const [index, point] of element.points.entries()) {
			const color = selectedIndexes.includes(index)
				? "#c94848"
				: element.type === "region" && element.waterEdges?.includes(index)
					? "#3d7fc4"
					: "#d9b45b";
			this.addEditHandle(builder, element.id, "point", index, point, color);
		}
	}

	/**
	 * Adds one visible and pickable edit handle.
	 *
	 * @param builder - The frame builder.
	 * @param elementId - The edited element identifier.
	 * @param action - The handle action.
	 * @param index - The related point index.
	 * @param point - The handle center.
	 * @param color - The handle fill color.
	 * @param radius - The handle radius in screen pixels.
	 * @returns Nothing.
	 * @sideEffects Adds editor render and picking data to `builder`.
	 */
	private addEditHandle(
		builder: MapWebglFrameBuilder,
		elementId: string,
		action: MapWebglPointAction,
		index: number,
		point: MapPoint,
		color: string,
		radius = 9,
	): void {
		const hovered = this.editHoverKey === `${elementId}:${action}:${index}`;
		const outline = this.addPointHandle(builder, point, color, hovered, radius);
		mapWebglAddPickMesh(builder, outline, { kind: "edit", elementId, action, index });
	}

	/**
	 * Adds one map control point.
	 *
	 * @param builder - The frame builder.
	 * @param point - The point center.
	 * @param color - The point fill color.
	 * @param hovered - Whether the pointer is over the point.
	 * @param radius - The point radius in screen pixels.
	 * @returns The point picking mesh.
	 * @sideEffects Adds point geometry to `builder`.
	 */
	private addPointHandle(
		builder: MapWebglFrameBuilder,
		point: MapPoint,
		color: string,
		hovered: boolean,
		radius = 9,
	): MapWebglMesh {
		const radiusVisible = radius + (hovered ? 2 : 0);
		const outline = mapWebglCircleMesh(point, (radiusVisible + 3) / this.view.zoom, 32);
		const fill = mapWebglCircleMesh(point, radiusVisible / this.view.zoom, 32);
		mapWebglAddShapeMesh(
			builder,
			outline,
			mapWebglSolidStyle(hovered ? "#f2cf78" : "#171b20", 0.95),
			false,
		);
		mapWebglAddShapeMesh(builder, fill, mapWebglSolidStyle(color, 1), false);
		return outline;
	}

	/**
	 * Starts resources for configured elements.
	 *
	 * @param scene - The complete map scene.
	 * @returns Nothing.
	 * @sideEffects Starts image and font requests.
	 */
	private prepareSceneResources(scene: MapWebglScene): void {
		const elementEditing = scene.overlay.editingElementId
			? scene.config.elements.find((element) => element.id === scene.overlay.editingElementId)
			: undefined;
		const revision = `content:${scene.contentRevision}:${scene.visibilityRevision}:${elementEditing ? mapWebglElementResourceRevision(elementEditing) : ""}`;
		if (this.resourceRevision === revision) return;
		this.resourceRevision = revision;
		for (const element of scene.elements) {
			if (element.type === "symbol") {
				const source = scene.symbolSources.get(element.assetUid);
				if (source) this.getImage(source, undefined, true, false, element.id);
				if (element.label) this.getFont(element.label.fontId, true, element.id);
			} else if (
				(element.type === "region" || element.type === "area") &&
				element.nameArc &&
				element.nameArc?.enabled !== false
			) {
				this.getFont(element.nameArc.fontId, true, element.id);
			} else if (
				element.type === "path" &&
				element.label &&
				element.label.enabled !== false
			) {
				this.getFont(element.label.fontId, true, element.id);
			}
		}
	}

	/**
	 * Tests whether each base resource for the visible scene completed its request.
	 *
	 * @param scene - The map scene with the visible elements.
	 * @returns `true` when no required image request is active.
	 */
	private sceneBaseResourcesReady(scene: MapWebglScene): boolean {
		const background = this.imageBySource.get(scene.imageSource);
		if (!background || background.loading) return false;
		if (this.labelsEnabled && [...this.fontsById.values()].some((font) => font.loading))
			return false;
		for (const element of scene.elements) {
			if (element.type !== "symbol") continue;
			const source = scene.symbolSources.get(element.assetUid);
			if (source && this.getImage(source, undefined, true, true, element.id).loading)
				return false;
		}
		return true;
	}

	/**
	 * Changes the revision for retained map content.
	 *
	 * @param revision - The current retained-content revision.
	 * @returns Nothing.
	 * @sideEffects Deletes stale GPU buffers.
	 */
	private setFrameCacheRevision(revision: string): void {
		if (this.frameCacheRevision === revision) return;
		if (this.frame) this.deleteRetainedFrame(this.frame);
		if (this.frameEditing) this.deleteRetainedFrame(this.frameEditing);
		this.frame = null;
		this.frameEditing = null;
		this.frameEditingRevision = "";
		this.frameOrderRevision = "";
		this.elementEditingId = null;
		this.visibilityRevision = "";
		this.frameCacheRevision = revision;
	}

	/**
	 * Reorders retained element ranges without rebuilding their geometry.
	 *
	 * @param frame - The retained map frame to reorder.
	 * @param elements - Every map element in the new paint order.
	 * @returns `true` when the retained ranges cover every requested element.
	 * @sideEffects Replaces three GPU buffer payloads and invalidates cached color and picking.
	 */
	private repackRetainedFrame(frame: MapWebglRetainedFrame, elements: MapElement[]): boolean {
		if (elements.length !== frame.elementRanges.size) return false;
		return this.mergeRetainedFrame(frame, elements, new Map());
	}

	/**
	 * Replaces changed element ranges and keeps all other geometry.
	 *
	 * @param frame - The retained map frame to change.
	 * @param scene - The map scene with the current elements.
	 * @param changedElementIds - Existing elements that need new geometry.
	 * @returns `true` when the renderer builds and merges all required ranges.
	 * @sideEffects Builds changed geometry and uploads the merged GPU buffers.
	 */
	private reconcileRetainedFrame(
		frame: MapWebglRetainedFrame,
		scene: MapWebglScene,
		changedElementIds: Iterable<string> = [],
	): boolean {
		const changed = new Set(changedElementIds);
		const replacements = new Map<string, MapWebglFrame>();
		let pickIdStart = mapWebglPickIdLast(frame.pickHits);
		for (const element of scene.elements) {
			if (frame.elementRanges.has(element.id) && !changed.has(element.id)) continue;
			const replacement = this.buildFrame(scene, [element], false, pickIdStart);
			if (!replacement.elementRanges.has(element.id)) return false;
			replacements.set(element.id, replacement);
			pickIdStart = mapWebglPickIdLast(replacement.pickHits, pickIdStart);
		}
		return this.mergeRetainedFrame(frame, scene.elements, replacements);
	}

	/**
	 * Merges retained and replacement ranges in paint order.
	 *
	 * @param frame - The retained frame that supplies the map image and unchanged ranges.
	 * @param elements - Every map element in paint order.
	 * @param replacements - New frames for added or changed elements.
	 * @returns `true` when each element has one source range.
	 * @sideEffects Replaces three GPU buffer payloads and invalidates cached color and picking.
	 */
	private mergeRetainedFrame(
		frame: MapWebglRetainedFrame,
		elements: MapElement[],
		replacements: Map<string, MapWebglFrame>,
	): boolean {
		const sources = elements.map((element) => {
			const source = replacements.get(element.id) ?? frame;
			const range = source.elementRanges.get(element.id);
			return range ? { source, range } : null;
		});
		if (sources.some((source) => !source)) return false;
		const present = sources as Array<{
			source: MapWebglFrame | MapWebglRetainedFrame;
			range: MapWebglElementRange;
		}>;
		const shapePrefix = Math.min(
			...Array.from(frame.elementRanges.values(), (range) => range.shapeOffset),
			frame.shapeVertices.length,
		);
		const texturePrefix = Math.min(
			...Array.from(frame.elementRanges.values(), (range) => range.textureOffset),
			frame.textureVertices.length,
		);
		const pickPrefix = Math.min(
			...Array.from(frame.elementRanges.values(), (range) => range.pickOffset),
			frame.pickVertices.length,
		);
		const shapeVertices = new Float32Array(
			shapePrefix + present.reduce((sum, { range }) => sum + range.shapeLength, 0),
		);
		const textureVertices = new Float32Array(
			texturePrefix + present.reduce((sum, { range }) => sum + range.textureLength, 0),
		);
		const pickVertices = new Float32Array(
			pickPrefix + present.reduce((sum, { range }) => sum + range.pickLength, 0),
		);
		shapeVertices.set(frame.shapeVertices.subarray(0, shapePrefix));
		textureVertices.set(frame.textureVertices.subarray(0, texturePrefix));
		pickVertices.set(frame.pickVertices.subarray(0, pickPrefix));
		let shapeOffset = shapePrefix;
		let textureOffset = texturePrefix;
		let pickOffset = pickPrefix;
		const elementRanges = new Map<string, MapWebglElementRange>();
		const pickHits = new Map<number, MapWebglHit>();
		const commands = frame.commands
			.filter((command) => command.kind === "texture" && !command.elementId)
			.map(mapWebglCloneCommand);
		for (const [index, element] of elements.entries()) {
			const entry = present[index];
			if (!entry) return false;
			const { source, range } = entry;
			const visibilityIndex = this.visibilityIndexes.get(element.id) ?? 0;
			shapeVertices.set(
				this.copyElementVertices(
					source.shapeVertices,
					range.shapeOffset,
					range.shapeLength,
					SHAPE_STRIDE,
					visibilityIndex,
				),
				shapeOffset,
			);
			textureVertices.set(
				this.copyElementVertices(
					source.textureVertices,
					range.textureOffset,
					range.textureLength,
					TEXTURE_STRIDE,
					visibilityIndex,
				),
				textureOffset,
			);
			pickVertices.set(
				this.copyElementVertices(
					source.pickVertices,
					range.pickOffset,
					range.pickLength,
					PICK_STRIDE,
					visibilityIndex,
				),
				pickOffset,
			);
			for (const [id, hit] of source.pickHits) {
				if (id > range.pickIdStart && id <= range.pickIdEnd) pickHits.set(id, hit);
			}
			const commandsElement = range.commands.map((command) =>
				mapWebglMoveCommand(
					command,
					(shapeOffset - range.shapeOffset) / SHAPE_STRIDE,
					(textureOffset - range.textureOffset) / TEXTURE_STRIDE,
				),
			);
			commands.push(...commandsElement);
			elementRanges.set(element.id, {
				shapeOffset,
				shapeLength: range.shapeLength,
				textureOffset,
				textureLength: range.textureLength,
				pickOffset,
				pickLength: range.pickLength,
				pickIdStart: range.pickIdStart,
				pickIdEnd: range.pickIdEnd,
				commands: commandsElement.map(mapWebglCloneCommand),
			});
			shapeOffset += range.shapeLength;
			textureOffset += range.textureLength;
			pickOffset += range.pickLength;
		}
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, frame.shapeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, shapeVertices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, frame.textureBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, textureVertices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, frame.pickBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, pickVertices, gl.DYNAMIC_DRAW);
		frame.commands = mapWebglCompactCommands(commands);
		frame.shapeVertices = shapeVertices;
		frame.textureVertices = textureVertices;
		frame.pickVertices = pickVertices;
		frame.pickVertexCount = pickVertices.length / PICK_STRIDE;
		frame.pickHits = pickHits;
		frame.elementRanges = elementRanges;
		this.invalidateRetainedColor(frame);
		this.pickDirty = true;
		return true;
	}

	/**
	 * Copies the live element data into its retained buffer ranges.
	 *
	 * @param elementId - The element to copy.
	 * @returns `true` when all retained ranges have compatible sizes.
	 * @sideEffects Changes GPU buffers and invalidates the retained color texture.
	 */
	private commitEditingFrame(elementId: string): boolean {
		const frame = this.frame;
		const frameEditing = this.frameEditing;
		if (!frame || !frameEditing) return false;
		const range = frame.elementRanges.get(elementId);
		const rangeEditing = frameEditing.elementRanges.get(elementId);
		if (
			!range ||
			!rangeEditing ||
			range.shapeLength !== rangeEditing.shapeLength ||
			range.textureLength !== rangeEditing.textureLength ||
			range.pickLength !== rangeEditing.pickLength
		)
			return false;
		const commands = frame.commands.filter(
			(command) => "elementId" in command && command.elementId === elementId,
		);
		const commandsEditing = frameEditing.commands.filter(
			(command) => "elementId" in command && command.elementId === elementId,
		);
		if (
			range.commands.length !== rangeEditing.commands.length ||
			range.commands.some(
				(command, index) => command.kind !== rangeEditing.commands[index]?.kind,
			) ||
			commands.length !== commandsEditing.length ||
			commands.some((command, index) => command.kind !== commandsEditing[index]?.kind)
		)
			return false;
		const visibilityIndex = this.visibilityIndexes.get(elementId) ?? 0;
		const shapeVertices = this.copyElementVertices(
			frameEditing.shapeVertices,
			rangeEditing.shapeOffset,
			rangeEditing.shapeLength,
			SHAPE_STRIDE,
			visibilityIndex,
		);
		const textureVertices = this.copyElementVertices(
			frameEditing.textureVertices,
			rangeEditing.textureOffset,
			rangeEditing.textureLength,
			TEXTURE_STRIDE,
			visibilityIndex,
		);
		const pickVertices = this.copyElementVertices(
			frameEditing.pickVertices,
			rangeEditing.pickOffset,
			rangeEditing.pickLength,
			PICK_STRIDE,
			visibilityIndex,
		);
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, frame.shapeBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, range.shapeOffset * 4, shapeVertices);
		gl.bindBuffer(gl.ARRAY_BUFFER, frame.textureBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, range.textureOffset * 4, textureVertices);
		gl.bindBuffer(gl.ARRAY_BUFFER, frame.pickBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, range.pickOffset * 4, pickVertices);
		frame.shapeVertices.set(shapeVertices, range.shapeOffset);
		frame.textureVertices.set(textureVertices, range.textureOffset);
		frame.pickVertices.set(pickVertices, range.pickOffset);
		for (const [index, command] of commands.entries()) {
			const commandEditing = commandsEditing[index];
			if (!commandEditing || command.kind !== commandEditing.kind) continue;
			if (command.kind === "texture" && commandEditing.kind === "texture") {
				command.texture = commandEditing.texture;
			} else if (command.kind === "vectorText" && commandEditing.kind === "vectorText") {
				command.anchor = commandEditing.anchor;
				command.scaleMode = commandEditing.scaleMode;
			}
		}
		for (const [index, command] of range.commands.entries()) {
			const commandEditing = rangeEditing.commands[index];
			if (!commandEditing || command.kind !== commandEditing.kind) continue;
			if (command.kind === "texture" && commandEditing.kind === "texture") {
				command.texture = commandEditing.texture;
			} else if (command.kind === "vectorText" && commandEditing.kind === "vectorText") {
				command.anchor = { ...commandEditing.anchor };
				command.scaleMode = commandEditing.scaleMode;
			}
		}
		this.invalidateRetainedColor(frame);
		this.pickDirty = true;
		return true;
	}

	/**
	 * Copies one element range and sets its retained visibility index.
	 *
	 * @param source - The live vertex array.
	 * @param offset - The first source float.
	 * @param length - The number of source floats.
	 * @param stride - The number of floats in one vertex.
	 * @param visibilityIndex - The retained visibility index.
	 * @returns A copy of the requested vertex range.
	 */
	private copyElementVertices(
		source: Float32Array,
		offset: number,
		length: number,
		stride: number,
		visibilityIndex: number,
	): Float32Array {
		const output = source.slice(offset, offset + length);
		for (let index = stride - 1; index < output.length; index += stride)
			output[index] = visibilityIndex;
		return output;
	}

	/**
	 * Uploads the visibility value for each configured element.
	 *
	 * @param scene - The map scene with the active layers.
	 * @returns Nothing.
	 * @sideEffects Changes the visibility texture and element-index table.
	 */
	private updateVisibility(scene: MapWebglScene): void {
		const revision = `${scene.visibilityRevision}:${scene.focusedRegionId ?? ""}:${scene.focusedRegionMode ?? ""}:${scene.overlay.editingElementId ?? ""}`;
		if (this.visibilityRevision === revision) return;
		const active = new Set(scene.activeLayerIds);
		const width = VISIBILITY_TEXTURE_WIDTH;
		const elementsIndexed = scene.config.elements;
		const height = Math.max(1, Math.ceil((elementsIndexed.length + 2) / width));
		const values = new Uint8Array(width * height * 2);
		values[0] = 255;
		values[1] = 255;
		const region = scene.elementsAll.find(
			(element) => element.id === scene.focusedRegionId && element.type === "region",
		);
		const boundsFocus = region?.type === "region" ? mapWebglPointBounds(region.points) : null;
		this.visibilityIndexes.clear();
		const elementEditing = scene.overlay.editingElementId
			? elementsIndexed.find((element) => element.id === scene.overlay.editingElementId)
			: undefined;
		const elementEditingSeparate = elementEditing?.type !== "grid";
		for (const [index, element] of elementsIndexed.entries()) {
			const visibilityIndex = index + 1;
			this.visibilityIndexes.set(element.id, visibilityIndex);
			if (
				(element.id !== scene.overlay.editingElementId || !elementEditingSeparate) &&
				element.layerIds.some((layerId) => active.has(layerId))
			) {
				values[visibilityIndex * 2] = 255;
				const bounds = this.meshesByElementId.get(element.id)?.pick.bounds;
				const outside =
					boundsFocus &&
					bounds &&
					(bounds.maxX < boundsFocus.minX ||
						bounds.minX > boundsFocus.maxX ||
						bounds.maxY < boundsFocus.minY ||
						bounds.minY > boundsFocus.maxY);
				if (!outside || element.parentRegionId === scene.focusedRegionId)
					values[visibilityIndex * 2 + 1] = 255;
			}
		}
		if (
			elementEditingSeparate &&
			elementEditing?.layerIds.some((layerId) => active.has(layerId))
		) {
			values[(elementsIndexed.length + 1) * 2] = 255;
			values[(elementsIndexed.length + 1) * 2 + 1] = 255;
		}
		const gl = this.gl;
		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_2D, this.visibilityTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, width, height, 0, gl.RG, gl.UNSIGNED_BYTE, values);
		this.visibilityWidth = width;
		this.visibilityRevision = revision;
		this.pickDirty = true;
	}

	/**
	 * Gets or starts one browser image texture.
	 *
	 * @param source - The image URL.
	 * @param imageElement - An existing image element to upload.
	 * @param mipmaps - Whether to generate mipmaps for an ordinary image.
	 * @param invalidateWhenReady - Whether a completed request must redraw the current frame.
	 * @param elementId - The element that uses the image.
	 * @param background - Whether the map background uses the image.
	 * @returns The image record.
	 */
	private getImage(
		source: string,
		imageElement?: HTMLImageElement,
		mipmaps = true,
		invalidateWhenReady = true,
		elementId?: string,
		background = false,
	): MapWebglImage {
		const current = this.imageBySource.get(source);
		if (current) {
			current.invalidateWhenReady ||= invalidateWhenReady;
			current.background ||= background;
			if (elementId) current.elementIds.add(elementId);
			return current;
		}
		const image = imageElement ?? new Image();
		const record: MapWebglImage = {
			image,
			texture: null,
			loading: true,
			failed: false,
			owned: !imageElement,
			invalidateWhenReady,
			background,
			elementIds: new Set(elementId ? [elementId] : []),
		};
		this.imageBySource.set(source, record);
		const upload = () => {
			if (this.destroyed) return;
			if (!image.complete || image.naturalWidth === 0) return;
			record.texture = mapWebglCreateImageTexture(
				this.gl,
				mapWebglTextureSource(image, source),
				mipmaps,
			);
			record.loading = false;
			if (record.invalidateWhenReady) {
				this.resourceBackgroundChanged ||= record.background;
				for (const id of record.elementIds) this.resourceElementIdsChanged.add(id);
				this.invalidate();
			}
		};
		image.addEventListener("load", upload, { once: true });
		image.addEventListener(
			"error",
			() => {
				if (this.destroyed) return;
				record.loading = false;
				record.failed = true;
				if (record.background) this.reportError(new Error("The map image could not load."));
				this.invalidate();
			},
			{ once: true },
		);
		if (imageElement && image.complete && image.naturalWidth > 0) {
			record.texture = mapWebglCreateImageTexture(
				this.gl,
				mapWebglTextureSource(image, source),
				mipmaps,
			);
			record.loading = false;
		} else {
			image.decoding = "async";
			image.crossOrigin = "anonymous";
			image.src = source;
		}
		return record;
	}

	/**
	 * Gets one generated font and starts loading it when needed.
	 *
	 * @param fontId - The configured font identifier.
	 * @param invalidateWhenReady - Whether a completed request must redraw the current frame.
	 * @param elementId - The element that uses the font.
	 * @returns The retained font resource.
	 * @sideEffects Starts a vector-font data request for a new font.
	 */
	private getFont(
		fontId = MAP_FONT_DEFAULT_ID,
		invalidateWhenReady = true,
		elementId?: string,
	): MapWebglFont {
		const definition =
			MAP_FONTS.find((font) => font.id === fontId) ??
			MAP_FONTS.find((font) => font.id === MAP_FONT_DEFAULT_ID) ??
			MAP_FONTS[0];
		const current = this.fontsById.get(definition.id);
		if (current) {
			current.invalidateWhenReady ||= invalidateWhenReady;
			if (elementId) current.elementIds.add(elementId);
			return current;
		}
		const font: MapWebglFont = {
			id: definition.id,
			sourceVector: definition.sourceVector,
			data: null,
			loading: true,
			failed: false,
			invalidateWhenReady,
			elementIds: new Set(elementId ? [elementId] : []),
		};
		this.fontsById.set(definition.id, font);
		fetch(definition.sourceVector)
			.then((response) => {
				if (!response.ok)
					throw new Error(`Font data request failed with ${response.status}.`);
				return response.json() as Promise<MapWebglFontData>;
			})
			.then((data) => {
				if (this.destroyed) return;
				font.data = data;
				font.loading = false;
				if (font.invalidateWhenReady) {
					for (const id of font.elementIds) this.resourceElementIdsChanged.add(id);
					this.elementsPrepared = null;
					this.invalidate();
				}
			})
			.catch((error: unknown) => {
				if (this.destroyed) return;
				font.loading = false;
				font.failed = true;
				console.error("The map label font could not load.", error);
				this.invalidate();
			});
		return font;
	}

	/**
	 * Gets one retained vector glyph.
	 *
	 * @param font - The loaded font resource.
	 * @param character - The character to get.
	 * @returns The glyph metrics, or `null` before the font is ready.
	 */
	private getGlyph(font: MapWebglFont, character: string): MapWebglGlyph | null {
		const data = font.data;
		if (!data) return null;
		const glyph = data.glyphs[mapWebglGlyphCharacter(data, character)];
		if (!glyph) return null;
		if (this.geometryWorkerFailed) {
			if (!glyph.contours) glyph.contours = mapWebglPathContours(glyph.commands);
			if (!glyph.fill) glyph.fill = mapWebglCompoundFillMesh(glyph.contours);
		}
		return glyph;
	}

	/**
	 * Stores a frame in dedicated GPU buffers.
	 *
	 * @param frame - The frame to upload.
	 * @returns The retained frame.
	 * @sideEffects Creates and fills three GPU buffers.
	 */
	private retainFrame(frame: MapWebglFrame): MapWebglRetainedFrame {
		const gl = this.gl;
		const shapeBuffer = mapWebglCreateBuffer(gl);
		const textureBuffer = mapWebglCreateBuffer(gl);
		const pickBuffer = mapWebglCreateBuffer(gl);
		gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.shapeVertices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.textureVertices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, pickBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.pickVertices, gl.DYNAMIC_DRAW);
		return {
			commands: frame.commands,
			shapeVertices: frame.shapeVertices,
			textureVertices: frame.textureVertices,
			pickVertices: frame.pickVertices,
			shapeBuffer,
			textureBuffer,
			pickBuffer,
			pickVertexCount: frame.pickVertices.length / PICK_STRIDE,
			pickHits: frame.pickHits,
			elementRanges: frame.elementRanges,
			colorTexture: null,
			colorWidth: 0,
			colorHeight: 0,
			colorViewKey: "",
		};
	}

	/**
	 * Replaces the data in existing retained-frame buffers.
	 *
	 * @param retained - The retained frame to change.
	 * @param frame - The new frame data.
	 * @returns Nothing.
	 * @sideEffects Uploads three arrays and removes a stale color texture.
	 */
	private updateRetainedFrame(retained: MapWebglRetainedFrame, frame: MapWebglFrame): void {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, retained.shapeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.shapeVertices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, retained.textureBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.textureVertices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, retained.pickBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.pickVertices, gl.DYNAMIC_DRAW);
		retained.commands = frame.commands;
		retained.shapeVertices = frame.shapeVertices;
		retained.textureVertices = frame.textureVertices;
		retained.pickVertices = frame.pickVertices;
		retained.pickVertexCount = frame.pickVertices.length / PICK_STRIDE;
		retained.pickHits = frame.pickHits;
		retained.elementRanges = frame.elementRanges;
		this.invalidateRetainedColor(retained);
	}

	/**
	 * Removes the cached color texture from one retained frame.
	 *
	 * @param frame - The retained frame to invalidate.
	 * @returns Nothing.
	 * @sideEffects Deletes the frame color texture.
	 */
	private invalidateRetainedColor(frame: MapWebglRetainedFrame): void {
		if (frame.colorTexture) this.gl.deleteTexture(frame.colorTexture);
		frame.colorTexture = null;
		frame.colorWidth = 0;
		frame.colorHeight = 0;
		frame.colorViewKey = "";
	}

	/**
	 * Deletes the GPU buffers for one retained frame.
	 *
	 * @param frame - The retained frame to delete.
	 * @returns Nothing.
	 * @sideEffects Deletes three GPU buffers.
	 */
	private deleteRetainedFrame(frame: MapWebglRetainedFrame): void {
		this.gl.deleteBuffer(frame.shapeBuffer);
		this.gl.deleteBuffer(frame.textureBuffer);
		this.gl.deleteBuffer(frame.pickBuffer);
		if (frame.colorTexture) this.gl.deleteTexture(frame.colorTexture);
	}

	/**
	 * Uploads transient overlay arrays without changing retained content buffers.
	 *
	 * @param frame - The overlay frame to upload.
	 * @returns Nothing.
	 * @sideEffects Replaces the overlay GPU buffers.
	 */
	private uploadOverlayFrame(frame: MapWebglFrame): void {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.overlayShapeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.shapeVertices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.overlayTextureBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.textureVertices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.overlayPickBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, frame.pickVertices, gl.DYNAMIC_DRAW);
	}

	/**
	 * Runs the visible render passes for one frame.
	 *
	 * @param frame - The frame to draw.
	 * @param frameEditing - The live edited-element frame.
	 * @param frameRuler - The completed-ruler frame.
	 * @param overlayFrame - The transient overlay frame.
	 * @param scene - The current retained scene.
	 * @returns Nothing.
	 * @sideEffects Paints the visible canvas.
	 */
	private drawColorFrame(
		frame: MapWebglRetainedFrame,
		frameEditing: MapWebglRetainedFrame | null,
		frameRuler: MapWebglRetainedFrame | null,
		overlayFrame: MapWebglFrame | null,
		scene: MapWebglScene,
	): void {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.targetWidth, this.targetHeight);
		gl.disable(gl.SCISSOR_TEST);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		const viewKey = this.colorViewKey(scene.visibilityRevision);
		if (frame.colorTexture && frame.colorViewKey === viewKey) {
			this.drawScreenTexture(frame.colorTexture);
		} else {
			if (this.frameBackground) this.drawRetainedContent(this.frameBackground);
			this.drawRetainedContent(frame);
			if (this.view.colorCache) this.captureRetainedColor(frame, viewKey);
		}
		if (frameEditing) this.drawRetainedContent(frameEditing);
		if (this.frameFocus) this.drawRetainedContent(this.frameFocus);
		if (frameRuler) this.drawRetainedContent(frameRuler);
		gl.enable(gl.BLEND);
		for (const command of overlayFrame?.commands ?? []) {
			if (command.kind === "shape") this.drawShapeCommand(command, this.overlayShapeBuffer);
			else if (command.kind === "texture")
				this.drawTextureCommand(command, this.overlayTextureBuffer);
			else if (command.kind === "vectorText")
				this.drawVectorTextCommand(command, this.overlayShapeBuffer);
		}
		if (this.interactionEnabled) this.drawInteraction(scene);
	}

	/**
	 * Draws the retained map content without transient overlays.
	 *
	 * @param frame - The retained frame to draw.
	 * @returns Nothing.
	 * @sideEffects Paints the active framebuffer.
	 */
	private drawRetainedContent(frame: MapWebglRetainedFrame): void {
		const gl = this.gl;
		gl.enable(gl.BLEND);
		for (const command of frame.commands) {
			if (command.kind === "shape") this.drawShapeCommand(command, frame.shapeBuffer);
			else if (command.kind === "texture")
				this.drawTextureCommand(command, frame.textureBuffer);
			else if (command.kind === "vectorText")
				this.drawVectorTextCommand(command, frame.shapeBuffer);
		}
	}

	/**
	 * Gets the key for the current canvas view.
	 *
	 * @param visibilityRevision - The current element-visibility revision.
	 * @returns A key that changes with the canvas size or map transform.
	 */
	private colorViewKey(visibilityRevision: string): string {
		return `${this.targetWidth},${this.targetHeight}|${this.view.panX},${this.view.panY},${this.view.zoom}|${visibilityRevision}`;
	}

	/**
	 * Copies the antialiased canvas content into a retained map texture.
	 *
	 * @param frame - The retained frame that owns the texture.
	 * @param viewKey - The current canvas-view key.
	 * @returns Nothing.
	 * @sideEffects Creates or changes a GPU texture.
	 */
	private captureRetainedColor(frame: MapWebglRetainedFrame, viewKey: string): void {
		const gl = this.gl;
		if (!frame.colorTexture) {
			frame.colorTexture = gl.createTexture();
			if (!frame.colorTexture) throw new Error("WebGL cannot create a map texture.");
			gl.bindTexture(gl.TEXTURE_2D, frame.colorTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		} else {
			gl.bindTexture(gl.TEXTURE_2D, frame.colorTexture);
		}
		if (frame.colorWidth !== this.targetWidth || frame.colorHeight !== this.targetHeight) {
			gl.copyTexImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				0,
				0,
				this.targetWidth,
				this.targetHeight,
				0,
			);
			frame.colorWidth = this.targetWidth;
			frame.colorHeight = this.targetHeight;
		} else {
			gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, this.targetWidth, this.targetHeight);
		}
		frame.colorViewKey = viewKey;
	}

	/**
	 * Draws one retained layer texture across the canvas.
	 *
	 * @param texture - The retained layer texture.
	 * @returns Nothing.
	 * @sideEffects Paints the active framebuffer.
	 */
	private drawScreenTexture(texture: WebGLTexture): void {
		const gl = this.gl;
		gl.disable(gl.BLEND);
		gl.useProgram(this.presentProgram.program);
		this.selectAttributes("screen", [
			this.presentProgram.position,
			this.presentProgram.textureCoordinate,
		]);
		mapWebglBindScreenAttributes(gl, this.presentProgram, this.screenBuffer);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(this.presentProgram.texture, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	/**
	 * Draws transient hover and pressed feedback without rebuilding the retained frame.
	 *
	 * @param scene - The current scene and interaction state.
	 * @returns Nothing.
	 * @sideEffects Uploads a small transient buffer and paints the canvas.
	 */
	private drawInteraction(scene: MapWebglScene): void {
		const idsDesired = new Set(
			[
				scene.overlay.editingElementId,
				scene.overlay.elementActiveId,
				scene.overlay.elementHoverId,
			].filter((id): id is string => Boolean(id)),
		);
		const time = performance.now();
		const opacityAt = (transition: MapWebglInteractionTransition) => {
			const progress = Math.min(
				Math.max((time - transition.timeStart) / INTERACTION_TRANSITION_DURATION, 0),
				1,
			);
			const eased = 1 - (1 - progress) ** 3;
			return (
				transition.startOpacity +
				(transition.targetOpacity - transition.startOpacity) * eased
			);
		};
		for (const id of idsDesired) {
			const transition = this.interactionTransitions.get(id);
			if (!transition) {
				this.interactionTransitions.set(id, {
					opacity: 0,
					startOpacity: 0,
					targetOpacity: 1,
					timeStart: time,
				});
			} else if (transition.targetOpacity !== 1) {
				transition.opacity = opacityAt(transition);
				transition.startOpacity = transition.opacity;
				transition.targetOpacity = 1;
				transition.timeStart = time;
			}
		}
		for (const [id, transition] of this.interactionTransitions) {
			if (!idsDesired.has(id) && transition.targetOpacity !== 0) {
				transition.opacity = opacityAt(transition);
				transition.startOpacity = transition.opacity;
				transition.targetOpacity = 0;
				transition.timeStart = time;
			}
		}
		let animating = false;
		const elementsById = new Map(scene.elements.map((element) => [element.id, element]));
		for (const [id, transition] of this.interactionTransitions) {
			transition.opacity = opacityAt(transition);
			const finished = time - transition.timeStart >= INTERACTION_TRANSITION_DURATION;
			if (finished) transition.opacity = transition.targetOpacity;
			else animating = true;
			const element = elementsById.get(id);
			if (element && transition.opacity > 0.001)
				this.drawInteractionGlow(
					element,
					scene,
					transition.opacity,
					id === scene.focusedRegionId && element.type === "region",
				);
			if (finished && transition.targetOpacity === 0) this.interactionTransitions.delete(id);
		}
		if (animating) this.scheduleInteractionFrame();
	}

	/**
	 * Draws one element glow at a selected opacity.
	 *
	 * @param element - The highlighted element.
	 * @param scene - The current map scene.
	 * @param opacity - The current transition opacity.
	 * @param inner - Whether the blur appears inside the shape.
	 * @returns Nothing.
	 * @sideEffects Uploads a transient mask and paints the canvas.
	 */
	private drawInteractionGlow(
		element: MapElement,
		scene: MapWebglScene,
		opacity: number,
		inner = false,
	): void {
		const meshes = this.getElementMeshes(element);
		const mesh = element.type === "path" ? meshes.stroke : (meshes.fill ?? meshes.pick);
		if (!mesh) return;
		const workHorizontal = this.targets[0];
		const workVertical = this.targets[1];
		const mask = this.targets[2];
		if (!workHorizontal || !workVertical || !mask) return;
		const gl = this.gl;
		gl.disable(gl.SCISSOR_TEST);
		gl.disable(gl.BLEND);
		gl.bindFramebuffer(gl.FRAMEBUFFER, mask.framebuffer);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		const symbolSource =
			element.type === "symbol" ? scene.symbolSources.get(element.assetUid) : undefined;
		const symbolTexture = symbolSource ? this.imageBySource.get(symbolSource)?.texture : null;
		if (symbolTexture && !(element.type === "symbol" && element.shape === "circle")) {
			const vertices: number[] = [];
			const meshTexture =
				element.type === "symbol"
					? mapWebglRectangleMesh(
							element.center,
							element.width,
							element.height,
							element.rotation,
						)
					: mesh;
			mapWebglAddTexturedVertices(
				vertices,
				meshTexture.vertices,
				0,
				element.type === "symbol" && element.shape === "circle",
			);
			gl.useProgram(this.textureProgram.program);
			this.selectAttributes("texture", [
				this.textureProgram.position,
				this.textureProgram.visibilityIndex,
				this.textureProgram.textureCoordinate,
				this.textureProgram.round,
			]);
			mapWebglSetView(gl, this.textureProgram.view, this.textureProgram.size, this.view);
			this.bindVisibility(
				this.textureProgram.visibility,
				this.textureProgram.visibilityWidth,
			);
			gl.uniform3f(this.textureProgram.localTransform, 0, 0, 1);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.interactionTextureBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
			mapWebglBindTextureAttributes(gl, this.textureProgram, this.interactionTextureBuffer);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, symbolTexture);
			gl.uniform1i(this.textureProgram.texture, 0);
			gl.drawArrays(gl.TRIANGLES, 0, vertices.length / TEXTURE_STRIDE);
		} else {
			const vertices = mapWebglSolidVertexData(
				mesh.vertices,
				mapWebglSolidStyle("#ffffff", 1),
				false,
				0,
				mesh.bounds,
			);
			gl.useProgram(this.shapeProgram.program);
			this.selectAttributes("shape", [
				this.shapeProgram.position,
				this.shapeProgram.visibilityIndex,
				this.shapeProgram.colorStart,
				this.shapeProgram.colorEnd,
				this.shapeProgram.gradientStart,
				this.shapeProgram.gradientEnd,
				this.shapeProgram.gradientOffset,
			]);
			mapWebglSetView(gl, this.shapeProgram.view, this.shapeProgram.size, this.view);
			this.bindVisibility(this.shapeProgram.visibility, this.shapeProgram.visibilityWidth);
			gl.uniform3f(this.shapeProgram.localTransform, 0, 0, 1);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.interactionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
			mapWebglShapeAttributes(gl, this.shapeProgram);
			gl.drawArrays(gl.TRIANGLES, 0, vertices.length / SHAPE_STRIDE);
		}
		const ratio = this.targetWidth / Math.max(this.view.width, 1);
		this.drawGlowBlurPass(mask.texture, workHorizontal, 10 * ratio, 0);
		this.drawGlowBlurPass(workHorizontal.texture, workVertical, 0, 10 * ratio);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.enable(gl.BLEND);
		gl.useProgram(this.glowProgram.program);
		this.selectAttributes("screen", [
			this.glowProgram.position,
			this.glowProgram.textureCoordinate,
		]);
		mapWebglBindScreenAttributes(gl, this.glowProgram, this.screenBuffer);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, workVertical.texture);
		gl.uniform1i(this.glowProgram.texture, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, mask.texture);
		if (this.glowProgram.textureMask) gl.uniform1i(this.glowProgram.textureMask, 1);
		if (this.glowProgram.opacity) gl.uniform1f(this.glowProgram.opacity, opacity);
		if (this.glowProgram.inner) gl.uniform1f(this.glowProgram.inner, inner ? 1 : 0);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	/**
	 * Requests the next internal interaction-transition frame.
	 *
	 * @returns Nothing.
	 * @sideEffects Schedules one animation frame and redraws the latest scene.
	 */
	private scheduleInteractionFrame(): void {
		if (this.interactionFrame || this.destroyed) return;
		this.interactionFrame = requestAnimationFrame(() => {
			this.interactionFrame = 0;
			if (this.sceneLast && !this.destroyed) this.draw(this.sceneLast, this.view);
		});
	}

	/**
	 * Draws the picking buffer for one frame.
	 *
	 * @param frame - The content frame to draw.
	 * @param frameEditing - The edited-element frame to draw above the content.
	 * @param frameRuler - The completed-ruler frame.
	 * @param overlayFrame - The overlay frame to draw above it.
	 * @returns Nothing.
	 * @sideEffects Paints the offscreen picking target.
	 */
	private drawPickFrame(
		frame: MapWebglRetainedFrame,
		frameEditing: MapWebglRetainedFrame | null,
		frameRuler: MapWebglRetainedFrame | null,
		overlayFrame: MapWebglFrame | null,
	): void {
		const target = this.targets[3];
		if (!target) return;
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
		gl.viewport(0, 0, this.targetWidth, this.targetHeight);
		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(this.pickProgram.program);
		mapWebglSetView(gl, this.pickProgram.view, this.pickProgram.size, this.view);
		this.bindVisibility(this.pickProgram.visibility, this.pickProgram.visibilityWidth);
		this.drawPickVertices(frame.pickBuffer, frame.pickVertexCount);
		if (frameEditing)
			this.drawPickVertices(frameEditing.pickBuffer, frameEditing.pickVertexCount);
		if (frameRuler) this.drawPickVertices(frameRuler.pickBuffer, frameRuler.pickVertexCount);
		if (overlayFrame)
			this.drawPickVertices(
				this.overlayPickBuffer,
				overlayFrame.pickVertices.length / PICK_STRIDE,
			);
		gl.enable(gl.BLEND);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	/**
	 * Draws one retained picking array with the active picking program.
	 *
	 * @param buffer - The picking vertex buffer.
	 * @param count - The number of vertices to draw.
	 * @returns Nothing.
	 * @sideEffects Changes vertex attributes and paints the active target.
	 */
	private drawPickVertices(buffer: WebGLBuffer, count: number): void {
		const gl = this.gl;
		this.selectAttributes("pick", [
			this.pickProgram.position,
			this.pickProgram.visibilityIndex,
			this.pickProgram.color,
		]);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(this.pickProgram.position);
		gl.vertexAttribPointer(this.pickProgram.position, 2, gl.FLOAT, false, PICK_STRIDE * 4, 0);
		gl.enableVertexAttribArray(this.pickProgram.color);
		gl.vertexAttribPointer(this.pickProgram.color, 3, gl.FLOAT, false, PICK_STRIDE * 4, 2 * 4);
		gl.enableVertexAttribArray(this.pickProgram.visibilityIndex);
		gl.vertexAttribPointer(
			this.pickProgram.visibilityIndex,
			1,
			gl.FLOAT,
			false,
			PICK_STRIDE * 4,
			5 * 4,
		);
		gl.drawArrays(gl.TRIANGLES, 0, count);
	}

	/**
	 * Draws a batched shape command.
	 *
	 * @param command - The shape command.
	 * @param buffer - The shape vertex buffer.
	 * @returns Nothing.
	 * @sideEffects Adds shapes to the active framebuffer.
	 */
	private drawShapeCommand(command: MapWebglShapeCommand, buffer: WebGLBuffer): void {
		const gl = this.gl;
		const program = this.shapeProgram;
		this.selectAttributes("shape", [
			program.position,
			program.visibilityIndex,
			program.colorStart,
			program.colorEnd,
			program.gradientStart,
			program.gradientEnd,
			program.gradientOffset,
		]);
		gl.useProgram(program.program);
		mapWebglSetView(gl, program.view, program.size, this.view);
		this.bindVisibility(program.visibility, program.visibilityWidth);
		gl.uniform3f(program.localTransform, 0, 0, 1);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		mapWebglShapeAttributes(gl, program);
		gl.drawArrays(gl.TRIANGLES, command.offset, command.count);
	}

	/**
	 * Draws one image command.
	 *
	 * @param command - The texture command.
	 * @param buffer - The texture vertex buffer.
	 * @returns Nothing.
	 * @sideEffects Adds an image to the active framebuffer.
	 */
	private drawTextureCommand(command: MapWebglTextureCommand, buffer: WebGLBuffer): void {
		const gl = this.gl;
		const program = this.textureProgram;
		this.selectAttributes("texture", [
			program.position,
			program.visibilityIndex,
			program.textureCoordinate,
			program.round,
		]);
		gl.useProgram(program.program);
		mapWebglSetView(gl, program.view, program.size, this.view);
		this.bindVisibility(program.visibility, program.visibilityWidth);
		gl.uniform3f(program.localTransform, 0, 0, 1);
		mapWebglBindTextureAttributes(gl, program, buffer);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, command.texture);
		gl.uniform1i(program.texture, 0);
		gl.drawArrays(gl.TRIANGLES, command.offset, command.count);
	}

	/**
	 * Draws one vector-text command.
	 *
	 * @param command - The text command.
	 * @param buffer - The shape vertex buffer.
	 * @returns Nothing.
	 * @sideEffects Adds glyphs to the active framebuffer.
	 */
	private drawVectorTextCommand(command: MapWebglVectorTextCommand, buffer: WebGLBuffer): void {
		const gl = this.gl;
		const program = this.shapeProgram;
		this.selectAttributes("shape", [
			program.position,
			program.visibilityIndex,
			program.colorStart,
			program.colorEnd,
			program.gradientStart,
			program.gradientEnd,
			program.gradientOffset,
		]);
		gl.useProgram(program.program);
		mapWebglSetView(gl, program.view, program.size, this.view);
		this.bindVisibility(program.visibility, program.visibilityWidth);
		const scale =
			command.scaleMode === "screen"
				? 1 / this.view.zoom
				: command.scaleMode === "clamp"
					? Math.min(1, 1 / this.view.zoom)
					: 1;
		gl.uniform3f(program.localTransform, command.anchor.x, command.anchor.y, scale);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		mapWebglShapeAttributes(gl, program);
		gl.drawArrays(gl.TRIANGLES, command.offset, command.count);
	}

	/**
	 * Runs one directional glow-blur pass.
	 *
	 * @param source - The source texture.
	 * @param target - The output target.
	 * @param x - The horizontal blur radius in drawing pixels.
	 * @param y - The vertical blur radius in drawing pixels.
	 * @returns Nothing.
	 * @sideEffects Paints the output target.
	 */
	private drawGlowBlurPass(
		source: WebGLTexture,
		target: MapWebglTarget,
		x: number,
		y: number,
	): void {
		const gl = this.gl;
		const program = this.glowBlurProgram;
		this.selectAttributes("screen", [program.position, program.textureCoordinate]);
		gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
		gl.useProgram(program.program);
		mapWebglBindScreenAttributes(gl, program, this.screenBuffer);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, source);
		gl.uniform1i(program.texture, 0);
		if (program.direction)
			gl.uniform2f(program.direction, x / this.targetWidth / 3, y / this.targetHeight / 3);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	/**
	 * Binds the element-visibility table to one shader program.
	 *
	 * @param textureLocation - The visibility-texture uniform.
	 * @param widthLocation - The visibility-texture width uniform.
	 * @returns Nothing.
	 * @sideEffects Changes the active texture and shader uniforms.
	 */
	private bindVisibility(
		textureLocation: WebGLUniformLocation,
		widthLocation: WebGLUniformLocation,
	): void {
		const gl = this.gl;
		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_2D, this.visibilityTexture);
		gl.uniform1i(textureLocation, 3);
		gl.uniform1i(widthLocation, this.visibilityWidth);
	}

	/**
	 * Enables only the vertex attributes for one program type.
	 *
	 * @param key - The program-type key.
	 * @param locations - The active attribute locations.
	 * @returns Nothing.
	 * @sideEffects Changes enabled WebGL vertex attributes.
	 */
	private selectAttributes(key: string, locations: number[]): void {
		if (this.attributeKey === key) return;
		const active = new Set(locations);
		const count = this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS) as number;
		for (let index = 0; index < count; index += 1) {
			if (active.has(index)) this.gl.enableVertexAttribArray(index);
			else this.gl.disableVertexAttribArray(index);
		}
		this.attributeKey = key;
	}
}

/**
 * Creates the shape shader program record.
 *
 * @param gl - The WebGL context.
 * @returns The linked program and its locations.
 */
function mapWebglCreateShapeProgram(gl: WebGL2RenderingContext): MapWebglShapeProgram {
	const program = mapWebglCreateProgram(gl, VERTEX_SHAPE, FRAGMENT_SHAPE);
	return {
		program,
		position: gl.getAttribLocation(program, "a_position"),
		visibilityIndex: gl.getAttribLocation(program, "a_visibilityIndex"),
		colorStart: gl.getAttribLocation(program, "a_colorStart"),
		colorEnd: gl.getAttribLocation(program, "a_colorEnd"),
		gradientStart: gl.getAttribLocation(program, "a_gradientStart"),
		gradientEnd: gl.getAttribLocation(program, "a_gradientEnd"),
		gradientOffset: gl.getAttribLocation(program, "a_gradientOffset"),
		view: mapWebglUniform(gl, program, "u_view"),
		size: mapWebglUniform(gl, program, "u_size"),
		localTransform: mapWebglUniform(gl, program, "u_localTransform"),
		visibility: mapWebglUniform(gl, program, "u_visibility"),
		visibilityWidth: mapWebglUniform(gl, program, "u_visibilityWidth"),
	};
}

/**
 * Creates an image shader program record.
 *
 * @param gl - The WebGL context.
 * @param fragmentSource - The fragment shader source.
 * @returns The linked program and its locations.
 */
function mapWebglCreateTextureProgram(
	gl: WebGL2RenderingContext,
	fragmentSource: string,
): MapWebglTextureProgram {
	const program = mapWebglCreateProgram(gl, VERTEX_TEXTURE, fragmentSource);
	return {
		program,
		position: gl.getAttribLocation(program, "a_position"),
		visibilityIndex: gl.getAttribLocation(program, "a_visibilityIndex"),
		textureCoordinate: gl.getAttribLocation(program, "a_textureCoordinate"),
		round: gl.getAttribLocation(program, "a_round"),
		view: mapWebglUniform(gl, program, "u_view"),
		size: mapWebglUniform(gl, program, "u_size"),
		texture: mapWebglUniform(gl, program, "u_texture"),
		localTransform: mapWebglUniform(gl, program, "u_localTransform"),
		visibility: mapWebglUniform(gl, program, "u_visibility"),
		visibilityWidth: mapWebglUniform(gl, program, "u_visibilityWidth"),
	};
}

/**
 * Creates the picking shader program record.
 *
 * @param gl - The WebGL context.
 * @returns The linked program and its locations.
 */
function mapWebglCreatePickProgram(gl: WebGL2RenderingContext): MapWebglPickProgram {
	const program = mapWebglCreateProgram(gl, VERTEX_PICK, FRAGMENT_PICK);
	return {
		program,
		position: gl.getAttribLocation(program, "a_position"),
		visibilityIndex: gl.getAttribLocation(program, "a_visibilityIndex"),
		color: gl.getAttribLocation(program, "a_color"),
		view: mapWebglUniform(gl, program, "u_view"),
		size: mapWebglUniform(gl, program, "u_size"),
		visibility: mapWebglUniform(gl, program, "u_visibility"),
		visibilityWidth: mapWebglUniform(gl, program, "u_visibilityWidth"),
	};
}

/**
 * Creates a screen-pass shader program record.
 *
 * @param gl - The WebGL context.
 * @param fragmentSource - The fragment shader source.
 * @returns The linked program and its locations.
 */
function mapWebglCreateScreenProgram(
	gl: WebGL2RenderingContext,
	fragmentSource: string,
): MapWebglScreenProgram {
	const program = mapWebglCreateProgram(gl, VERTEX_SCREEN, fragmentSource);
	return {
		program,
		position: gl.getAttribLocation(program, "a_position"),
		textureCoordinate: gl.getAttribLocation(program, "a_textureCoordinate"),
		texture: mapWebglUniform(gl, program, "u_texture"),
		direction: gl.getUniformLocation(program, "u_direction"),
		textureMask: gl.getUniformLocation(program, "u_textureMask"),
		opacity: gl.getUniformLocation(program, "u_opacity"),
		inner: gl.getUniformLocation(program, "u_inner"),
	};
}

/**
 * Compiles and links one WebGL program.
 *
 * @param gl - The WebGL context.
 * @param vertexSource - The vertex shader source.
 * @param fragmentSource - The fragment shader source.
 * @returns The linked program.
 * @throws An error when shader compilation or program linking fails.
 */
function mapWebglCreateProgram(
	gl: WebGL2RenderingContext,
	vertexSource: string,
	fragmentSource: string,
): WebGLProgram {
	const vertex = mapWebglCreateShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragment = mapWebglCreateShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	const program = gl.createProgram();
	if (!program) throw new Error("WebGL cannot create a shader program.");
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) ?? "Unknown link error.";
		gl.deleteProgram(program);
		throw new Error(`WebGL cannot link a shader program: ${log}`);
	}
	return program;
}

/**
 * Compiles one WebGL shader.
 *
 * @param gl - The WebGL context.
 * @param type - The WebGL shader type.
 * @param source - The shader source.
 * @returns The compiled shader.
 * @throws An error when shader compilation fails.
 */
function mapWebglCreateShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("WebGL cannot create a shader.");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) ?? "Unknown compile error.";
		gl.deleteShader(shader);
		throw new Error(`WebGL cannot compile a shader: ${log}`);
	}
	return shader;
}

/**
 * Gets one required uniform location.
 *
 * @param gl - The WebGL context.
 * @param program - The linked program.
 * @param name - The uniform name.
 * @returns The uniform location.
 * @throws An error when the program does not contain the uniform.
 */
function mapWebglUniform(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	name: string,
): WebGLUniformLocation {
	const location = gl.getUniformLocation(program, name);
	if (!location) throw new Error(`WebGL cannot find the ${name} uniform.`);
	return location;
}

/**
 * Creates one required WebGL buffer.
 *
 * @param gl - The WebGL context.
 * @returns The new buffer.
 * @throws An error when WebGL cannot create the buffer.
 */
function mapWebglCreateBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
	const buffer = gl.createBuffer();
	if (!buffer) throw new Error("WebGL cannot create a buffer.");
	return buffer;
}

/**
 * Creates one texture-backed framebuffer.
 *
 * @param gl - The WebGL context.
 * @param width - The target width.
 * @param height - The target height.
 * @returns The complete framebuffer target.
 * @throws An error when WebGL cannot create the target.
 */
function mapWebglCreateTarget(
	gl: WebGL2RenderingContext,
	width: number,
	height: number,
): MapWebglTarget {
	const texture = gl.createTexture();
	const framebuffer = gl.createFramebuffer();
	if (!texture || !framebuffer) throw new Error("WebGL cannot create a render target.");
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		gl.deleteFramebuffer(framebuffer);
		gl.deleteTexture(texture);
		throw new Error("WebGL cannot complete a render target.");
	}
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	return { framebuffer, texture };
}

/**
 * Deletes one framebuffer target.
 *
 * @param gl - The WebGL context.
 * @param target - The target to delete.
 * @returns Nothing.
 * @sideEffects Deletes the framebuffer and texture.
 */
function mapWebglDeleteTarget(gl: WebGL2RenderingContext, target: MapWebglTarget): void {
	gl.deleteFramebuffer(target.framebuffer);
	gl.deleteTexture(target.texture);
}

/**
 * Creates a WebGL texture from a browser image.
 *
 * @param gl - The WebGL context.
 * @param source - The raster source.
 * @param mipmaps - Whether to generate mipmaps for an ordinary image.
 * @returns The image texture.
 * @throws An error when WebGL cannot create the texture.
 */
function mapWebglCreateImageTexture(
	gl: WebGL2RenderingContext,
	source: TexImageSource,
	mipmaps = true,
): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) throw new Error("WebGL cannot create an image texture.");
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texParameteri(
		gl.TEXTURE_2D,
		gl.TEXTURE_MIN_FILTER,
		mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
	if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
	return texture;
}

/**
 * Converts an SVG image to a raster source for a WebGL upload.
 *
 * @param image - The loaded browser image.
 * @param source - The image URL.
 * @returns The original image or a canvas that contains the SVG pixels.
 * @throws An error when the browser cannot create a 2D canvas context.
 * @sideEffects Creates and paints a canvas for an SVG source.
 */
function mapWebglTextureSource(image: HTMLImageElement, source: string): TexImageSource {
	if (!mapWebglSourceIsSvg(source)) return image;
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(image.naturalWidth, 1);
	canvas.height = Math.max(image.naturalHeight, 1);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("WebGL cannot rasterize the SVG image.");
	context.drawImage(image, 0, 0, canvas.width, canvas.height);
	return canvas;
}

/**
 * Tests whether an image source contains SVG data.
 *
 * @param source - The image URL.
 * @returns True when the source is an SVG URL or an SVG data URL.
 */
function mapWebglSourceIsSvg(source: string): boolean {
	return /\.svg(?:[?#]|$)/iu.test(source) || /^data:image\/svg\+xml(?:[;,]|$)/iu.test(source);
}

/**
 * Adds a styled mesh to the shape buffer.
 *
 * @param builder - The frame builder.
 * @param mesh - The mesh to add.
 * @param style - The element style.
 * @param border - Whether to use the border color.
 * @param checkered - Whether the fill shows the composite pattern.
 * @returns Nothing.
 * @sideEffects Adds vertices and extends the current shape command.
 */
function mapWebglAddShapeMesh(
	builder: MapWebglFrameBuilder,
	mesh: MapWebglMesh,
	style: MapElementStyle,
	border: boolean,
	checkered = false,
): void {
	if (mesh.vertices.length === 0) return;
	if (builder.shapeStart === null)
		builder.shapeStart = builder.shapeVertices.length / SHAPE_STRIDE;
	const vertices = mapWebglSolidVertexData(
		mesh.vertices,
		style,
		border,
		builder.visibilityIndex,
		mesh.bounds,
	);
	if (checkered) {
		for (let index = 14; index < vertices.length; index += SHAPE_STRIDE) vertices[index] = -1;
	}
	mapWebglAppendNumbers(builder.shapeVertices, vertices);
}

/**
 * Converts position vertices to styled shape vertices.
 *
 * @param vertices - The triangle positions.
 * @param style - The element style.
 * @param border - Whether to use the border color.
 * @param visibilityIndex - The element index in the visibility texture.
 * @param bounds - The known mesh bounds.
 * @returns The interleaved shape vertices.
 */
function mapWebglSolidVertexData(
	vertices: Float32Array,
	style: MapElementStyle,
	border: boolean,
	visibilityIndex = 0,
	bounds: MapBounds = mapWebglPointBounds(mapWebglVerticesToPoints(vertices)),
): Float32Array {
	const gradientLine = mapGradientLine(bounds, style.fillGradient?.angle ?? 0);
	const start = border
		? mapWebglColor(style.borderColor, style.borderOpacity)
		: mapWebglColor(style.fillColor, style.fillOpacity);
	const end =
		border || !style.fillGradient
			? start
			: mapWebglColor(style.fillGradient.color, style.fillGradient.opacity);
	const offset = border ? 0 : (style.fillGradient?.offset ?? 0) / 100;
	const output = new Float32Array((vertices.length / 2) * SHAPE_STRIDE);
	for (let source = 0, target = 0; source < vertices.length; source += 2) {
		output[target] = vertices[source] ?? 0;
		output[target + 1] = vertices[source + 1] ?? 0;
		output[target + 2] = start[0];
		output[target + 3] = start[1];
		output[target + 4] = start[2];
		output[target + 5] = start[3];
		output[target + 6] = end[0];
		output[target + 7] = end[1];
		output[target + 8] = end[2];
		output[target + 9] = end[3];
		output[target + 10] = gradientLine.x1;
		output[target + 11] = gradientLine.y1;
		output[target + 12] = gradientLine.x2;
		output[target + 13] = gradientLine.y2;
		output[target + 14] = offset;
		output[target + 15] = visibilityIndex;
		target += SHAPE_STRIDE;
	}
	return output;
}

/**
 * Ends the current batched shape command.
 *
 * @param builder - The frame builder.
 * @returns Nothing.
 * @sideEffects Adds the completed command to `builder`.
 */
function mapWebglFlushShapeCommand(builder: MapWebglFrameBuilder): void {
	if (builder.shapeStart === null) return;
	const end = builder.shapeVertices.length / SHAPE_STRIDE;
	builder.commands.push({
		kind: "shape",
		offset: builder.shapeStart,
		count: end - builder.shapeStart,
	});
	builder.shapeStart = null;
}

/**
 * Completes a frame builder and creates typed vertex arrays.
 *
 * @param builder - The frame builder to complete.
 * @returns The completed frame.
 * @sideEffects Adds the final batched shape command to `builder`.
 */
function mapWebglFinishFrame(builder: MapWebglFrameBuilder): MapWebglFrame {
	mapWebglFlushShapeCommand(builder);
	return {
		commands: mapWebglCompactCommands(builder.commands),
		shapeVertices: new Float32Array(builder.shapeVertices),
		textureVertices: new Float32Array(builder.textureVertices),
		pickVertices: new Float32Array(builder.pickVertices),
		pickHits: builder.pickHits,
		elementRanges: builder.elementRanges,
	};
}

/**
 * Gets the largest pick identifier in a hit table.
 *
 * @param hits - The pick hits that use numeric identifiers.
 * @param minimum - The smallest permitted result.
 * @returns The largest identifier or the supplied minimum.
 */
function mapWebglPickIdLast(hits: Map<number, MapWebglHit>, minimum = 0): number {
	let next = minimum;
	for (const id of hits.keys()) next = Math.max(next, id);
	return next;
}

/**
 * Builds a resource key for one element.
 *
 * @param element - The element that can use an SVG image or a label font.
 * @returns A key that changes only when the element needs another resource.
 */
function mapWebglElementResourceRevision(element: MapElement): string {
	if (element.type === "tactical") return `${element.id}:tactical:${element.kind}`;
	if (element.type === "symbol")
		return `${element.id}:symbol:${element.assetUid}:${element.label?.fontId ?? ""}:${Boolean(element.label)}`;
	if (element.type === "grid") return `${element.id}:grid`;
	if (element.type === "region" || element.type === "area")
		return `${element.id}:name:${element.nameArc?.fontId ?? ""}:${Boolean(element.nameArc && element.nameArc.enabled !== false)}`;
	return `${element.id}:path:${element.label?.fontId ?? ""}:${element.label?.enabled !== false}:${Boolean(element.label)}`;
}

/**
 * Copies only the serializable fields that the geometry worker reads.
 *
 * @param element - A map element that can contain Svelte state proxies.
 * @returns A plain map element for a worker message.
 */
function mapWebglGeometryElementCopy(element: MapElement): MapElement {
	const layerIds = [...element.layerIds];
	if (element.type === "symbol") {
		return {
			id: element.id,
			type: element.type,
			layerIds,
			assetUid: element.assetUid,
			subtype: element.subtype,
			parameters: element.parameters ? { ...element.parameters } : undefined,
			center: { ...element.center },
			width: element.width,
			height: element.height,
			rotation: element.rotation,
			shape: element.shape,
			style: element.style ? { ...element.style } : undefined,
		};
	}
	const style = {
		...element.style,
		fillGradient: element.style.fillGradient ? { ...element.style.fillGradient } : undefined,
	};
	if (element.type === "grid") {
		return {
			id: element.id,
			type: element.type,
			layerIds,
			style,
			center: { ...element.center },
			width: element.width,
			height: element.height,
			rotation: element.rotation,
			columnCount: element.columnCount,
			rowCount: element.rowCount,
			subdivisionCount: element.subdivisionCount,
		};
	}
	if (element.type === "area") {
		return {
			id: element.id,
			type: element.type,
			layerIds,
			style,
			center: { ...element.center },
			radius: element.radius,
		};
	}
	if (element.type === "tactical") {
		return {
			id: element.id,
			type: element.type,
			layerIds,
			style,
			kind: element.kind,
			points: element.points.map((point) => ({ ...point })),
			smoothing: element.smoothing,
			stylePresetId: element.stylePresetId,
			parameters: { ...element.parameters },
		};
	}
	return {
		id: element.id,
		layerIds,
		style,
		points: element.points.map((point) => ({ ...point })),
		smoothing: element.smoothing,
		...(element.type === "region"
			? { type: element.type, subtype: element.subtype }
			: { type: element.type, subtype: element.subtype }),
		parameters: element.parameters ? { ...element.parameters } : undefined,
		...(element.type === "region" && element.waterEdges
			? { waterEdges: [...element.waterEdges] }
			: {}),
	};
}

/**
 * Copies a draw command and its mutable point data.
 *
 * @param command - The command to copy.
 * @returns An independent command with the same draw range.
 */
function mapWebglCloneCommand(command: MapWebglCommand): MapWebglCommand {
	if (command.kind === "shape") return { ...command };
	if (command.kind === "texture") return { ...command };
	return { ...command, anchor: { ...command.anchor } };
}

/**
 * Moves one command to a repacked vertex range.
 *
 * @param command - The source command.
 * @param shapeDelta - The shape-vertex offset change.
 * @param textureDelta - The texture-vertex offset change.
 * @returns A copied command with its applicable offset changed.
 */
function mapWebglMoveCommand(
	command: MapWebglCommand,
	shapeDelta: number,
	textureDelta: number,
): MapWebglCommand {
	const moved = mapWebglCloneCommand(command);
	if (moved.kind === "texture") moved.offset += textureDelta;
	else moved.offset += shapeDelta;
	return moved;
}

/**
 * Joins adjacent shape ranges into one draw command.
 *
 * @param commands - The commands in paint order.
 * @returns Commands with directly adjacent shape ranges combined.
 */
function mapWebglCompactCommands(commands: MapWebglCommand[]): MapWebglCommand[] {
	const compact: MapWebglCommand[] = [];
	for (const command of commands) {
		const previous = compact.at(-1);
		if (
			command.kind === "shape" &&
			previous?.kind === "shape" &&
			previous.offset + previous.count === command.offset
		) {
			previous.count += command.count;
		} else compact.push(mapWebglCloneCommand(command));
	}
	return compact;
}

/**
 * Adds a textured rectangle command.
 *
 * @param builder - The frame builder.
 * @param vertices - Six triangle positions.
 * @param texture - The image texture.
 * @returns Nothing.
 * @sideEffects Adds texture vertices and one command to `builder`.
 */
function mapWebglAddTextureCommand(
	builder: MapWebglFrameBuilder,
	vertices: Float32Array,
	texture: WebGLTexture,
	round = false,
): void {
	mapWebglFlushShapeCommand(builder);
	const offset = builder.textureVertices.length / TEXTURE_STRIDE;
	mapWebglAddTexturedVertices(builder.textureVertices, vertices, builder.visibilityIndex, round);
	builder.commands.push({
		kind: "texture",
		offset,
		count: builder.textureVertices.length / TEXTURE_STRIDE - offset,
		texture,
		elementId: builder.elementId,
	});
}

/**
 * Adds one retained vector-text command.
 *
 * @param builder - The frame builder.
 * @param verticesBorder - The interleaved outline vertices.
 * @param verticesFill - The interleaved fill vertices.
 * @param anchor - The optional screen-scale anchor.
 * @param scaleMode - The zoom scaling behavior.
 * @returns Nothing.
 * @sideEffects Adds glyph vertices and one command to `builder`.
 */
function mapWebglAddVectorTextCommand(
	builder: MapWebglFrameBuilder,
	verticesBorder: number[],
	verticesFill: number[],
	anchor: MapPoint = { x: 0, y: 0 },
	scaleMode: MapWebglVectorTextCommand["scaleMode"] = "map",
): void {
	if (verticesBorder.length === 0 && verticesFill.length === 0) return;
	mapWebglFlushShapeCommand(builder);
	const offset = builder.shapeVertices.length / SHAPE_STRIDE;
	mapWebglAppendNumbers(builder.shapeVertices, verticesBorder);
	mapWebglAppendNumbers(builder.shapeVertices, verticesFill);
	builder.commands.push({
		kind: "vectorText",
		offset,
		count: builder.shapeVertices.length / SHAPE_STRIDE - offset,
		anchor,
		scaleMode,
		elementId: builder.elementId,
	});
}

/**
 * Adds one mesh and hit identifier to the picking buffer.
 *
 * @param builder - The frame builder.
 * @param mesh - The pickable mesh.
 * @param hit - The hit result for the mesh.
 * @returns Nothing.
 * @sideEffects Adds picking vertices and a hit-table entry.
 */
function mapWebglAddPickMesh(
	builder: MapWebglFrameBuilder,
	mesh: MapWebglMesh,
	hit: MapWebglHit,
): void {
	if (!builder.pickingEnabled || mesh.vertices.length === 0) return;
	builder.pickId += 1;
	const id = builder.pickId;
	const color = [(id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255];
	for (let index = 0; index < mesh.vertices.length; index += 2) {
		builder.pickVertices.push(
			mesh.vertices[index] ?? 0,
			mesh.vertices[index + 1] ?? 0,
			...color,
			builder.visibilityIndex,
		);
	}
	builder.pickHits.set(id, hit);
}

/**
 * Adds texture coordinates to six rectangle positions.
 *
 * @param output - The output vertex list.
 * @param vertices - Six triangle positions.
 * @param visibilityIndex - The element index in the visibility texture.
 * @returns Nothing.
 * @sideEffects Adds interleaved position and texture data to `output`.
 */
function mapWebglAddTexturedVertices(
	output: number[],
	vertices: Float32Array,
	visibilityIndex = 0,
	round = false,
): void {
	const coordinates = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
	for (let index = 0; index < vertices.length / 2; index += 1) {
		output.push(
			vertices[index * 2] ?? 0,
			vertices[index * 2 + 1] ?? 0,
			coordinates[index * 2] ?? 0,
			coordinates[index * 2 + 1] ?? 0,
			round ? 1 : 0,
			visibilityIndex,
		);
	}
}

/**
 * Adds one transformed vector glyph to a styled vertex list.
 *
 * @param outputBorder - The output outline vertex list.
 * @param outputFill - The output fill vertex list.
 * @param glyph - The retained vector glyph.
 * @param origin - The glyph baseline origin.
 * @param scale - The font-to-map scale.
 * @param rotation - The clockwise rotation in radians.
 * @param offsetX - The extra baseline offset.
 * @param borderWidth - The glyph outline width in map units.
 * @param fillColor - The glyph fill color.
 * @param borderColor - The glyph outline color.
 * @param visibilityIndex - The element index in the visibility texture.
 * @returns Nothing.
 * @sideEffects Adds styled glyph triangles to `output`.
 */
function mapWebglAddGlyphGeometry(
	outputBorder: number[],
	outputFill: number[],
	glyph: MapWebglGlyph,
	origin: MapPoint,
	scale: number,
	rotation: number,
	offsetX: number,
	borderWidth: number,
	fillColor: [number, number, number, number],
	borderColor: [number, number, number, number],
	visibilityIndex: number,
): void {
	if (!glyph.fill || !glyph.contours) return;
	const transform = (point: MapPoint) =>
		mapWebglRotatedPoint(origin, offsetX + point.x * scale, -point.y * scale, rotation);
	const fillVertices = new Float32Array(glyph.fill.vertices.length);
	for (let index = 0; index < glyph.fill.vertices.length; index += 2) {
		const point = transform({
			x: glyph.fill.vertices[index] ?? 0,
			y: glyph.fill.vertices[index + 1] ?? 0,
		});
		fillVertices[index] = point.x;
		fillVertices[index + 1] = point.y;
	}
	mapWebglAppendNumbers(
		outputFill,
		mapWebglColorVertexData(fillVertices, fillColor, visibilityIndex),
	);
	if (borderWidth > 0 && borderColor[3] > 0) {
		const outlineCached = glyph.outlines?.get(mapWebglOutlineKey(borderWidth / scale));
		if (outlineCached) {
			const vertices = new Float32Array(outlineCached.length);
			for (let index = 0; index < outlineCached.length; index += 2) {
				const point = transform({
					x: outlineCached[index] ?? 0,
					y: outlineCached[index + 1] ?? 0,
				});
				vertices[index] = point.x;
				vertices[index + 1] = point.y;
			}
			mapWebglAppendNumbers(
				outputBorder,
				mapWebglColorVertexData(vertices, borderColor, visibilityIndex),
			);
		} else {
			for (const contour of glyph.contours) {
				const points = contour.map(transform);
				const outline = mapWebglStrokeMesh([{ startIndex: 0, points }], borderWidth);
				mapWebglAppendNumbers(
					outputBorder,
					mapWebglColorVertexData(outline.vertices, borderColor, visibilityIndex),
				);
			}
		}
	}
}

/**
 * Creates the shared key for a glyph-outline width in font units.
 *
 * @param width - The outline width before glyph placement scaling.
 * @returns The stable outline-cache key.
 */
function mapWebglOutlineKey(width: number): string {
	return String(width);
}

/**
 * Gets the stored glyph character for one source character.
 *
 * @param font - The loaded vector-font data.
 * @param character - The source text character.
 * @returns The source character, a space for missing whitespace, or the fallback character.
 */
function mapWebglGlyphCharacter(font: MapWebglFontData, character: string): string {
	if (font.glyphs[character]) return character;
	if (/\s/u.test(character) && font.glyphs[" "]) return " ";
	return "?";
}

/**
 * Formats the distance label for one ruler path.
 *
 * @param scene - The map scene with the configured scale.
 * @param points - The ruler points to measure.
 * @returns The localized distance and its unit.
 */
function mapRulerDistanceText(scene: MapWebglScene, points: MapPoint[]): string {
	return `${formatMapDistance(mapPathDistance(points, scene.config.scale.x, scene.config.scale.y))} ${scene.config.scale.unit}`;
}

/**
 * Converts position vertices to styled vertices with one solid color.
 *
 * @param vertices - The triangle positions.
 * @param color - The normalized solid color.
 * @param visibilityIndex - The element index in the visibility texture.
 * @returns The interleaved shape vertices.
 */
function mapWebglColorVertexData(
	vertices: Float32Array,
	color: [number, number, number, number],
	visibilityIndex: number,
): Float32Array {
	const output = new Float32Array((vertices.length / 2) * SHAPE_STRIDE);
	for (let source = 0, target = 0; source < vertices.length; source += 2) {
		output[target] = vertices[source] ?? 0;
		output[target + 1] = vertices[source + 1] ?? 0;
		output[target + 2] = color[0];
		output[target + 3] = color[1];
		output[target + 4] = color[2];
		output[target + 5] = color[3];
		output[target + 6] = color[0];
		output[target + 7] = color[1];
		output[target + 8] = color[2];
		output[target + 9] = color[3];
		output[target + 10] = 0;
		output[target + 11] = 0;
		output[target + 12] = 1;
		output[target + 13] = 0;
		output[target + 14] = 0;
		output[target + 15] = visibilityIndex;
		target += SHAPE_STRIDE;
	}
	return output;
}

/**
 * Converts flat positions to map points.
 *
 * @param vertices - The flat position list.
 * @returns The point list.
 */
function mapWebglVerticesToPoints(vertices: Float32Array): MapPoint[] {
	const points: MapPoint[] = [];
	for (let index = 0; index < vertices.length; index += 2) {
		points.push({ x: vertices[index] ?? 0, y: vertices[index + 1] ?? 0 });
	}
	return points;
}

/**
 * Adds an array-like number list without a spread-call limit.
 *
 * @param output - The output number list.
 * @param values - The values to add.
 * @returns Nothing.
 * @sideEffects Adds all `values` to `output`.
 */
function mapWebglAppendNumbers(output: number[], values: ArrayLike<number>): void {
	for (let index = 0; index < values.length; index += 1) output.push(values[index] ?? 0);
}

/**
 * Parses a hexadecimal color and applies opacity.
 *
 * @param color - The six-digit hexadecimal color.
 * @param opacity - The alpha value from 0 through 1.
 * @returns The normalized red, green, blue, and alpha values.
 */
function mapWebglColor(color: string, opacity: number): [number, number, number, number] {
	return [
		Number.parseInt(color.slice(1, 3), 16) / 255,
		Number.parseInt(color.slice(3, 5), 16) / 255,
		Number.parseInt(color.slice(5, 7), 16) / 255,
		opacity,
	];
}

/**
 * Creates a solid style for transient overlays.
 *
 * @param color - The fill and border color.
 * @param opacity - The fill and border opacity.
 * @returns The complete solid style.
 */
function mapWebglSolidStyle(color: string, opacity: number): MapElementStyle {
	return {
		borderColor: color,
		borderOpacity: opacity,
		borderWidth: 1,
		fillColor: color,
		fillOpacity: opacity,
	};
}

/**
 * Rotates an offset around a center point.
 *
 * @param center - The rotation center.
 * @param offsetX - The horizontal offset.
 * @param offsetY - The vertical offset.
 * @param rotation - The clockwise rotation in radians.
 * @returns The rotated point.
 */
function mapWebglRotatedPoint(
	center: MapPoint,
	offsetX: number,
	offsetY: number,
	rotation: number,
): MapPoint {
	const cosine = Math.cos(rotation);
	const sine = Math.sin(rotation);
	return {
		x: center.x + offsetX * cosine - offsetY * sine,
		y: center.y + offsetX * sine + offsetY * cosine,
	};
}

/**
 * Sets the shared map transform uniforms.
 *
 * @param gl - The WebGL context.
 * @param viewLocation - The view uniform location.
 * @param sizeLocation - The viewport-size uniform location.
 * @param view - The current map view.
 * @returns Nothing.
 * @sideEffects Changes uniforms on the active program.
 */
function mapWebglSetView(
	gl: WebGL2RenderingContext,
	viewLocation: WebGLUniformLocation,
	sizeLocation: WebGLUniformLocation,
	view: MapWebglView,
): void {
	gl.uniform3f(viewLocation, view.panX, view.panY, view.zoom);
	gl.uniform2f(sizeLocation, view.width, view.height);
}

/**
 * Enables the attributes for the shape buffer.
 *
 * @param gl - The WebGL context.
 * @param program - The active shape program.
 * @returns Nothing.
 * @sideEffects Changes the active vertex attributes.
 */
function mapWebglShapeAttributes(gl: WebGL2RenderingContext, program: MapWebglShapeProgram): void {
	const stride = SHAPE_STRIDE * 4;
	const attributes: Array<[number, number, number]> = [
		[program.position, 2, 0],
		[program.colorStart, 4, 2],
		[program.colorEnd, 4, 6],
		[program.gradientStart, 2, 10],
		[program.gradientEnd, 2, 12],
		[program.gradientOffset, 1, 14],
		[program.visibilityIndex, 1, 15],
	];
	for (const [location, size, offset] of attributes) {
		gl.enableVertexAttribArray(location);
		gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * 4);
	}
}

/**
 * Enables the attributes for a textured map buffer.
 *
 * @param gl - The WebGL context.
 * @param program - The active texture program.
 * @param buffer - The interleaved texture buffer.
 * @returns Nothing.
 * @sideEffects Changes the active buffer and vertex attributes.
 */
function mapWebglBindTextureAttributes(
	gl: WebGL2RenderingContext,
	program: MapWebglTextureProgram,
	buffer: WebGLBuffer,
): void {
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.enableVertexAttribArray(program.position);
	gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, TEXTURE_STRIDE * 4, 0);
	gl.enableVertexAttribArray(program.textureCoordinate);
	gl.vertexAttribPointer(
		program.textureCoordinate,
		2,
		gl.FLOAT,
		false,
		TEXTURE_STRIDE * 4,
		2 * 4,
	);
	gl.enableVertexAttribArray(program.visibilityIndex);
	gl.vertexAttribPointer(program.visibilityIndex, 1, gl.FLOAT, false, TEXTURE_STRIDE * 4, 5 * 4);
	gl.enableVertexAttribArray(program.round);
	gl.vertexAttribPointer(program.round, 1, gl.FLOAT, false, TEXTURE_STRIDE * 4, 4 * 4);
}

/**
 * Enables the attributes for a screen-pass buffer.
 *
 * @param gl - The WebGL context.
 * @param program - The active screen program.
 * @param buffer - The screen-quad buffer.
 * @returns Nothing.
 * @sideEffects Changes the active buffer and vertex attributes.
 */
function mapWebglBindScreenAttributes(
	gl: WebGL2RenderingContext,
	program: MapWebglScreenProgram,
	buffer: WebGLBuffer,
): void {
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.enableVertexAttribArray(program.position);
	gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, SCREEN_STRIDE * 4, 0);
	gl.enableVertexAttribArray(program.textureCoordinate);
	gl.vertexAttribPointer(program.textureCoordinate, 2, gl.FLOAT, false, SCREEN_STRIDE * 4, 2 * 4);
}

/**
 * Throws when WebGL reports an error during development.
 *
 * @param gl - The WebGL context.
 * @param operation - The operation that completed.
 * @throws An error when the WebGL error flag is not `NO_ERROR`.
 */
function mapWebglThrowError(gl: WebGL2RenderingContext, operation: string): void {
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`WebGL error ${error} after ${operation}.`);
}
