struct Uniforms {
    stride: u32,
    workgroupsPerDimension: u32
};

@group(0) @binding(0) var<storage, read_write> workBuffer: array<f32>;
@group(0) @binding(1) var<uniform> u: Uniforms;

@compute @workgroup_size(1) fn reduceProbabilities(
    @builtin(global_invocation_id) id: vec3u
) {
    let i = id.x * u.workgroupsPerDimension + id.y;

    let row1 = i * u.stride * 2;
    let row2 = row1 + u.stride;

    workBuffer[row1] = workBuffer[row1] + workBuffer[row2];
}