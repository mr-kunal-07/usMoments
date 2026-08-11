/**
 * Component Memoization Optimization Guide
 * 
 * Use React.memo to prevent unnecessary re-renders when props haven't changed.
 * This is especially important for:
 * - List items (re-render on every parent update even though data unchanged)
 * - UI components (buttons, cards in modals)
 * - Large complex components (Dashboard views)
 * 
 * WHEN TO USE:
 * 1. Component receives props but doesn't always change them
 * 2. Component is expensive to render (heavy calculations, animations)
 * 3. Component is in a frequently-updated parent
 * 
 * WHEN NOT TO USE:
 * 1. Component rarely renders
 * 2. Props always change on every render
 * 3. Component has no props
 * 
 * IMPLEMENTATION PATTERN:
 * 
 * Instead of:
 * ```
 * function MediaCard({ media }) {
 *   return <div>{media.name}</div>
 * }
 * export default MediaCard;
 * ```
 * 
 * Use:
 * ```
 * function MediaCard({ media }) {
 *   return <div>{media.name}</div>
 * }
 * export default React.memo(MediaCard);
 * ```
 * 
 * WITH CUSTOM COMPARISON:
 * ```
 * export default React.memo(MediaCard, (prevProps, nextProps) => {
 *   // Return true if they're equal (skip re-render)
 *   return prevProps.media.id === nextProps.media.id;
 * });
 * ```
 */

/**
 * QUICK MEMOIZATION TEMPLATE
 * Copy this pattern for any component that needs optimization
 */

import React from "react";

interface MemoizedComponentProps {
    data: any;
    onAction?: () => void;
}

const MemoizedComponent: React.FC<MemoizedComponentProps> = ({ data, onAction }) => {
    return (
        <div onClick={onAction}>
            {data.name}
        </div>
    );
};

export default React.memo(MemoizedComponent, (prev, next) => {
    // Custom comparison: return true if props are equivalent (don't re-render)
    return (
        prev.data.id === next.data.id &&
        prev.data.updated === next.data.updated
    );
});

/**
 * FOR COMPONENTS TO MEMOIZE IN ITSUSMOMENT:
 * 
 * 1. MediaCard / MediaItem (in MediaGrid)
 *    - Receives { media, onSelect, onDelete }
 *    - Re-renders on every grid update even though single item unchanged
 *    - Solution: memo + custom comparison by media.id
 * 
 * 2. FolderCard (in FolderGrid)
 *    - Receives { folder, onOpen, onRename }
 *    - Re-renders when other folders change
 *    - Solution: memo + custom comparison by folder.id
 * 
 * 3. Dashboard view components (Gallery, Moments, Chat, etc.)
 *    - Receives route params/state
 *    - Re-renders during navigation
 *    - Solution: memo + keep callbacks stable with useCallback
 * 
 * 4. ActivityFeedItem (in list)
 *    - Receives individual activity record
 *    - Re-renders on every feed update
 *    - Solution: memo + custom id comparison
 * 
 * 5. MessageBubble (in ChatView)
 *    - Receives message object
 *    - Re-renders when new messages arrive
 *    - Solution: memo + compare by message.id and message.content
 * 
 * 6. AvatarWithName / UserCard
 *    - Receives user profile
 *    - Often in lists
 *    - Solution: memo + compare by user.id
 */

/**
 * CUSTOM HOOK FOR MEMOIZATION
 * Use this if you have functions as props
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
    callback: T,
    deps: React.DependencyList
): T => {
    const memoizedCallback = React.useCallback(callback, deps);
    return memoizedCallback as T;
};

/**
 * PERFORMANCE MONITORING HELPER
 * Add to components to track re-renders in development
 */
export const useRenderCount = (componentName: string) => {
    const countRef = React.useRef(0);

    React.useEffect(() => {
        countRef.current += 1;
        if (process.env.NODE_ENV === "development") {
            console.log(`${componentName} rendered ${countRef.current} times`);
        }
    });

    return countRef.current;
};
