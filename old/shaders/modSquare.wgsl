@group(0) @binding(0) var realTexture: texture_2d<f32>;
@group(0) @binding(1) var imaginaryTexture: texture_2d<f32>;
@group(0) @binding(2) var modSquareTexture: texture_storage_2d<r32float, read_write>;

@compute @workgroup_size(1) fn modSquare(
    @builtin(global_invocation_id) id: vec3u
) {
    let realValue = textureLoad(realTexture, id.xy, 0);
    let imaginaryValue = textureLoad(imaginaryTexture, id.xy, 0);

    textureStore(modSquareTexture, id.xy, realValue*realValue + imaginaryValue*imaginaryValue);
}