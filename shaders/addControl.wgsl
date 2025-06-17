@group(0) @binding(0) var originalMatrix: texture_2d<f32>;
@group(0) @binding(1) var controlledMatrix: texture_storage_2d<r32float, read_write>;

@compute @workgroup_size(1)fn addControl(
    @builtin(global_invocation_id) id: vec3u
) {
    if id.y % 2 == 0 {
        if id.x == id.y {
            textureStore(controlledMatrix, id.xy, vec4f(1));
        } else {
            textureStore(controlledMatrix, id.xy, vec4f(0));
        }
    } else {
        if id.x % 2 == 0 {
            textureStore(controlledMatrix, id.xy, vec4f(0));
        } else {
            textureStore(controlledMatrix, id.xy, textureLoad(originalMatrix, vec2u(0.5 * vec2f(id.xy - vec2u(1, 1))), 0));
        }
    }
}