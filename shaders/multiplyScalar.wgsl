@group(0) @binding(0) var inputMatrix: texture_2d<f32>;
@group(0) @binding(1) var outputMatrix: texture_storage_2d<r32float, read_write>;

const scalar = _SCALAR;

@compute @workgroup_size(1)fn multiplyScalar(
    @builtin(global_invocation_id) id: vec3u
) {
    textureStore(outputMatrix, id.xy, scalar * textureLoad(inputMatrix, id.xy, 0));
}