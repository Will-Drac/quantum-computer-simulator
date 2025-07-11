@group(0) @binding(0) var<storage, read> probabilities: array<f32>;
@group(0) @binding(1) var<storage, read_write> probabilitiesPruned: array<f32>;

const workgroupsPerDimension = _WORKGROUPSPERDIM;
const size = _SIZE;
const qbit = _QBIT;

fn qbitIs0(value: u32) -> bool {
    return ((value >> qbit) & 1u) == 1;
}

@compute @workgroup_size(1) fn pruneProbabilities(
    @builtin(global_invocation_id) id: vec3u
) {
    let row = id.x * workgroupsPerDimension + id.y;

    if (row < size) {
        if (qbitIs0(row)) {
            probabilitiesPruned[row] = probabilities[row];
        }
        else {
            probabilitiesPruned[row] = 0;
        }
    }
}