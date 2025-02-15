import { ObjectId } from 'mongodb';
;
export function isRecipeSource(source) {
    if (!source || typeof source !== 'object')
        return false;
    const s = source;
    return (typeof s.title === 'string' &&
        typeof s.cuisine === 'string' &&
        ['easy', 'medium', 'hard'].includes(s.difficulty));
}
//# sourceMappingURL=models.js.map