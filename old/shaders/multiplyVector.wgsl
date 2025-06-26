@group(0) @binding(0) var matrix: texture_2d<f32>;
@group(0) @binding(1) var vector: texture_2d<f32>;
@group(0) @binding(2) var outputMatrix: texture_storage_2d<r32float, read_write>;

@compute @workgroup_size(1)fn addMatrices(
    @builtin(global_invocation_id) id: vec3u
) {
    let i = id.xy;

    let matrixValue = textureLoad(matrix, i, 0);
    let vectorValue = textureLoad(vector, vec2u(i.y, 0), 0);

    textureStore(
        outputMatrix,
        i,
        matrixValue * vectorValue
    );
}