// Supported skeleton types
// the file names for the skeleton types are associated with the const
export enum SkeletonType {
  Quadraped = 'skeletons/skeleton-quadraped.glb',
  Human = 'skeletons/human-skeleton.glb',
  Bird = 'skeletons/skeleton-bird.glb',
}

// Hand skeleton variation types for human skeleton
export enum HandSkeletonType {
  AllFingers = 'all-fingers',
  ThumbAndIndex = 'thumb-and-index',
  SimplifiedHand = 'simplified-hand',
  SingleBone = 'single-bone'
}
