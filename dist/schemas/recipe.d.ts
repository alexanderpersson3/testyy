import { z } from 'zod';
export declare const ingredientSchema: z.ZodObject<{
    name: z.ZodString;
    amount: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    unit?: string | undefined;
    amount?: number | undefined;
    notes?: string | undefined;
}, {
    name: string;
    unit?: string | undefined;
    amount?: number | undefined;
    notes?: string | undefined;
}>;
export declare const instructionSchema: z.ZodObject<{
    text: z.ZodString;
    time: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    time?: number | undefined;
    notes?: string | undefined;
    temperature?: number | undefined;
}, {
    text: string;
    time?: number | undefined;
    notes?: string | undefined;
    temperature?: number | undefined;
}>;
export declare const nutritionSchema: z.ZodObject<{
    calories: z.ZodOptional<z.ZodNumber>;
    protein: z.ZodOptional<z.ZodNumber>;
    carbs: z.ZodOptional<z.ZodNumber>;
    fat: z.ZodOptional<z.ZodNumber>;
    fiber: z.ZodOptional<z.ZodNumber>;
    sugar: z.ZodOptional<z.ZodNumber>;
    sodium: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    calories?: number | undefined;
    protein?: number | undefined;
    carbs?: number | undefined;
    fat?: number | undefined;
    fiber?: number | undefined;
    sugar?: number | undefined;
    sodium?: number | undefined;
}, {
    calories?: number | undefined;
    protein?: number | undefined;
    carbs?: number | undefined;
    fat?: number | undefined;
    fiber?: number | undefined;
    sugar?: number | undefined;
    sodium?: number | undefined;
}>;
export declare const parseRecipeSchema: z.ZodObject<{
    userId: z.ZodAny;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    prepTime: z.ZodNumber;
    cookTime: z.ZodNumber;
    totalTime: z.ZodOptional<z.ZodNumber>;
    servings: z.ZodNumber;
    difficulty: z.ZodEnum<["easy", "medium", "hard"]>;
    cuisine: z.ZodOptional<z.ZodString>;
    course: z.ZodOptional<z.ZodString>;
    ingredients: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        amount: z.ZodOptional<z.ZodNumber>;
        unit: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        unit?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
    }, {
        name: string;
        unit?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
    }>, "many">;
    instructions: z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        time: z.ZodOptional<z.ZodNumber>;
        temperature: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        time?: number | undefined;
        notes?: string | undefined;
        temperature?: number | undefined;
    }, {
        text: string;
        time?: number | undefined;
        notes?: string | undefined;
        temperature?: number | undefined;
    }>, "many">;
    nutrition: z.ZodOptional<z.ZodObject<{
        calories: z.ZodOptional<z.ZodNumber>;
        protein: z.ZodOptional<z.ZodNumber>;
        carbs: z.ZodOptional<z.ZodNumber>;
        fat: z.ZodOptional<z.ZodNumber>;
        fiber: z.ZodOptional<z.ZodNumber>;
        sugar: z.ZodOptional<z.ZodNumber>;
        sodium: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        calories?: number | undefined;
        protein?: number | undefined;
        carbs?: number | undefined;
        fat?: number | undefined;
        fiber?: number | undefined;
        sugar?: number | undefined;
        sodium?: number | undefined;
    }, {
        calories?: number | undefined;
        protein?: number | undefined;
        carbs?: number | undefined;
        fat?: number | undefined;
        fiber?: number | undefined;
        sugar?: number | undefined;
        sodium?: number | undefined;
    }>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    source: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
    title: string;
    difficulty: "easy" | "medium" | "hard";
    ingredients: {
        name: string;
        unit?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
    }[];
    instructions: {
        text: string;
        time?: number | undefined;
        notes?: string | undefined;
        temperature?: number | undefined;
    }[];
    servings: number;
    prepTime: number;
    cookTime: number;
    isPublic: boolean;
    userId?: any;
    tags?: string[] | undefined;
    description?: string | undefined;
    totalTime?: number | undefined;
    cuisine?: string | undefined;
    notes?: string | undefined;
    images?: string[] | undefined;
    nutrition?: {
        calories?: number | undefined;
        protein?: number | undefined;
        carbs?: number | undefined;
        fat?: number | undefined;
        fiber?: number | undefined;
        sugar?: number | undefined;
        sodium?: number | undefined;
    } | undefined;
    source?: string | undefined;
    course?: string | undefined;
}, {
    createdAt: Date;
    updatedAt: Date;
    title: string;
    difficulty: "easy" | "medium" | "hard";
    ingredients: {
        name: string;
        unit?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
    }[];
    instructions: {
        text: string;
        time?: number | undefined;
        notes?: string | undefined;
        temperature?: number | undefined;
    }[];
    servings: number;
    prepTime: number;
    cookTime: number;
    userId?: any;
    tags?: string[] | undefined;
    description?: string | undefined;
    totalTime?: number | undefined;
    cuisine?: string | undefined;
    notes?: string | undefined;
    images?: string[] | undefined;
    isPublic?: boolean | undefined;
    nutrition?: {
        calories?: number | undefined;
        protein?: number | undefined;
        carbs?: number | undefined;
        fat?: number | undefined;
        fiber?: number | undefined;
        sugar?: number | undefined;
        sodium?: number | undefined;
    } | undefined;
    source?: string | undefined;
    course?: string | undefined;
}>;
