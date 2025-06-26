@group(0) @binding(0) var leftMatrix: texture_2d<f32>;
@group(0) @binding(1) var rightMatrix: texture_2d<f32>;
@group(0) @binding(2) var outputMatrix: texture_storage_2d<r32float, read_write>;

@compute @workgroup_size(1)fn addMatrices(
    @builtin(global_invocation_id) id: vec3u
) {
    let L = textureDimensions(leftMatrix).y;

    var v: f32 = 0;
    for (var i: u32 = 0; i < L; i++) {
        let sampleLeft = vec2u(id.x, i);
        let sampleRight = vec2u(i, id.y);
        v += textureLoad(leftMatrix, sampleLeft, 0).r * textureLoad(rightMatrix, sampleRight, 0).r;
    }

    textureStore(outputMatrix, id.xy, vec4f(v));
}