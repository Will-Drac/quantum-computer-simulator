@group(0) @binding(0) var leftMatrix: texture_2d<f32>;
@group(0) @binding(1) var rightMatrix: texture_2d<f32>;
@group(0) @binding(2) var outputMatrix: texture_storage_2d<r32float, read_write>;

@compute @workgroup_size(1) fn addMatrices(
    @builtin(global_invocation_id) id: vec3u
) {
    let leftValue = textureLoad(leftMatrix, id.xy, 0);
    let rightValue = textureLoad(rightMatrix, id.xy, 0);

    textureStore(outputMatrix, id.xy, leftValue - rightValue);
}