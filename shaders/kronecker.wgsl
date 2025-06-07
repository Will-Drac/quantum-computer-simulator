@group(0) @binding(0) var leftMatrix: texture_2d<f32>;
@group(0) @binding(1) var rightMatrix: texture_2d<f32>;
@group(0) @binding(2) var outputMatrix: texture_storage_2d<r32float, read_write>;

@compute @workgroup_size(1)fn addMatrices(
    @builtin(global_invocation_id) id: vec3u
) {
    let i = vec2f(id.xy);

    let rightSize = vec2f(textureDimensions(rightMatrix));

    let leftIndex = vec2u(u32(i.x / rightSize.x), u32(i.y / rightSize.y));
    let rightIndex = vec2u(u32(i.x % rightSize.x), u32(i.y % rightSize.y));

    textureStore(
        outputMatrix,
        id.xy,
        textureLoad(leftMatrix, leftIndex, 0) * textureLoad(rightMatrix, rightIndex, 0)
    );
}