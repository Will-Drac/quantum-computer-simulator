struct Uniforms {
    stride: u32,
    numInvocations: u32
};

@group(0) @binding(0) var workTexture: texture_storage_2d<r32float, read_write>;
@group(0) @binding(1) var<uniform> u:Uniforms;

@compute @workgroup_size(1) fn computeSum(
    @builtin(global_invocation_id) id:vec3<u32>
){
    let columnIndex1 = id.y * u.stride * 2;
    let columnIndex2 = columnIndex1 + u.stride;

    let i1 = vec2u(id.x, columnIndex1);
    let i2 = vec2u(id.x, columnIndex2);

    let v1 = textureLoad(workTexture, i1);
    let v2 = textureLoad(workTexture, i2);

    textureStore(
        workTexture,
        i1,
        v1+v2
    );
}