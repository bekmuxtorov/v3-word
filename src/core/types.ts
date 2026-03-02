export type Alignment = 'left' | 'center' | 'right' | 'both';

export interface TabStop {
    position: number; // in pixels
    type: 'left' | 'right' | 'center' | 'decimal' | 'bar' | 'num';
    leader?: 'none' | 'dot' | 'hyphen' | 'underscore';
}

export interface ParagraphProperties {
    align?: Alignment;
    lineSpacing?: number;    // multiplier
    spaceBefore?: number;    // pixels
    spaceAfter?: number;     // pixels
    indentLeft?: number;
    indentFirstLine?: number;
    tabs?: TabStop[];
    borderBottom?: {
        style: string;
        size: number;
        color: string;
    };
}

// A single run of text with its own formatting
export interface TextRun {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    color?: string;        // hex e.g. "FF0000"
    fontSize?: number;     // in pt
    fontFamily?: string;
    isTab?: boolean;       // <w:tab/> marker
    isLineBreak?: boolean; // <w:br/>
}


export interface TableCell {
    nodes: DocumentNode[];
    width?: number; // pixels
    gridSpan?: number;
    vAlign?: 'top' | 'center' | 'bottom';
    borders?: {
        top?: { style: string; size: number; color: string };
        bottom?: { style: string; size: number; color: string };
        left?: { style: string; size: number; color: string };
        right?: { style: string; size: number; color: string };
    };
    background?: string;
}

export interface TableRow {
    cells: TableCell[];
    height?: number;
}

export interface TableNode {
    type: 'table';
    rows: TableRow[];
    grid?: number[]; // column widths in pixels
    borders?: {
        top?: { style: string; size: number; color: string };
        bottom?: { style: string; size: number; color: string };
        left?: { style: string; size: number; color: string };
        right?: { style: string; size: number; color: string };
        insideH?: { style: string; size: number; color: string };
        insideV?: { style: string; size: number; color: string };
    };
    widthValue?: { type: string; value: number };
}

export interface DocumentNode {
    type: 'paragraph' | 'text' | 'image' | 'table';
    // Table fields
    rows?: TableRow[];
    grid?: number[];
    borders?: {
        top?: { style: string; size: number; color: string };
        bottom?: { style: string; size: number; color: string };
        left?: { style: string; size: number; color: string };
        right?: { style: string; size: number; color: string };
        insideH?: { style: string; size: number; color: string };
        insideV?: { style: string; size: number; color: string };
    };
    widthValue?: { type: string; value: number };
    // Rich runs (formatted text inside a paragraph)
    runs?: TextRun[];
    // Legacy plain text (kept for compat)
    text?: string;
    align?: Alignment;
    // Image fields
    src?: string;
    width?: number;
    height?: number;
    nativeWidth?: number;
    nativeHeight?: number;
    pPr?: ParagraphProperties;
    // Absolute/Anchored positioning
    absolutePos?: {
        x?: number; // offset in px
        y?: number; // offset in px
        relH?: string; // 'page', 'column', 'margin'
        relV?: string; // 'page', 'paragraph', 'line', 'margin'
        alignH?: string; // 'center', 'right', 'left'
        alignV?: string; // 'top', 'bottom', 'center'
    };
    wrapType?: 'inline' | 'topAndBottom' | 'square' | 'none' | 'tight' | 'through';
    rotation?: number; // in degrees
    zIndex?: number;
    style?: any;
}

export type RenderItem = {
    type: 'text';
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    width: number;
    height: number;
    align?: Alignment;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    color?: string;
} | {
    type: 'image';
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    align?: Alignment;
    rotation?: number;
    zIndex?: number;
} | {
    type: 'line';
    x: number;
    y: number;
    width?: number;
    height?: number;
    lineWidth: number;
    color: string;
    lineStyle?: string;
};

export interface PageLayout {
    width: number;
    height: number;
    items: RenderItem[];
}

export interface PageSettings {
    width: number;
    height: number;
    margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
}

export interface DocumentDefaults {
    fontFamily?: string;
    fontSize?: number;
    lineSpacing?: number;
    color?: string;
}

export interface LayoutModel {
    documentId: string;
    pageSettings: PageSettings;
    defaults: DocumentDefaults;
    pages: PageLayout[];
    eofMarker: { x: number; y: number; pageIndex: number };
}
