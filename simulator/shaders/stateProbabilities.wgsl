@group(0) @binding(0) var<storage, read> stateReal: array<f32>;
@group(0) @binding(1) var<storage, read> stateImag: array<f32>;
@group(0) @binding(2) var<storage, read_write> probabilities: array<f32>;

const workgroupsPerDimension = _WORKGROUPSPERDIM;
const size = _SIZE;

@compute @workgroup_size(1) fn stateProbabilites(
    @builtin(global_invocation_id) id: vec3u
) {
    let row = id.x * workgroupsPerDimension + id.y;

    if (row < size) {
        probabilities[row] = stateReal[row]*stateReal[row] + stateImag[row]*stateImag[row];
    }
}