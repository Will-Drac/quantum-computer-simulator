@group(0) @binding(0) var<storage, read_write> entries: array<u32>;

const size = _SIZE;
const workgroupsPerDimension = _WORKGROUPSPERDIM;

@compute @workgroup_size(1) fn gphase(
    @builtin(global_invocation_id) id: vec3u
) {
    let row = id.x * workgroupsPerDimension + id.y;

    if (row < size) {
        entries[row] = row; //the first two bits will have values 0, which means that this entry is the phase multiplier
    }
}