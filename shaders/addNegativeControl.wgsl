@group(0) @binding(0) var<storage, read> oldEntries: array<u32>;
@group(0) @binding(1) var<storage, read_write> newEntries: array<u32>;

const size = _SIZE;
const isEntries0 = _ISENTRIES0; //if we're writing a 1, we only want to write it once per row, in this.entries[0]
const workgroupsPerDimension = _WORKGROUPSPERDIM;

@compute @workgroup_size(1)fn addControl(
    @builtin(global_invocation_id) id: vec3u
) {
    let newRow = id.x * workgroupsPerDimension + id.y;

    if newRow < size {
        if (newRow % 2 == 1 && isEntries0) {
            // this will be a 1 placed on the diagonal
            let newVal = (1 << 31) | newRow; //the column will just be the row, and we're appending that this value will be simply a 1
            newEntries[newRow] = newVal;
        }
        else {
            let oldRow = newRow/2; //points at the row in the old matrix holding this value
            let oldVal = oldEntries[oldRow];
            let data = oldVal >> 30; //preserve the data
            let oldColumnIndex = oldVal & 0x3FFFFFFF;

            let newColumnIndex = 2 * oldColumnIndex;

            let newVal = (data << 30) | newColumnIndex;
            newEntries[newRow] = newVal;
        }
    }
}