import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../package.json.js';
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Rezepta API',
            version,
            description: 'API documentation for the Rezepta recipe management platform',
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
            contact: {
                name: 'API Support',
                url: 'https://rezepta.com/support',
                email: 'support@rezepta.com',
            },
        },
        servers: [
            {
                url: process.env.API_URL || 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    description: 'Error message',
                                },
                                code: {
                                    type: 'string',
                                    description: 'Error code',
                                },
                                data: {
                                    type: 'object',
                                    description: 'Additional error data',
                                },
                            },
                            required: ['message'],
                        },
                    },
                    required: ['error'],
                },
                Recipe: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            format: 'ObjectId',
                        },
                        title: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 200,
                        },
                        description: {
                            type: 'string',
                            maxLength: 2000,
                        },
                        ingredients: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: {
                                        type: 'string',
                                        minLength: 1,
                                        maxLength: 100,
                                    },
                                    amount: {
                                        type: 'number',
                                        minimum: 0,
                                    },
                                    unit: {
                                        type: 'string',
                                        maxLength: 20,
                                    },
                                    notes: {
                                        type: 'string',
                                        maxLength: 200,
                                    },
                                },
                                required: ['name'],
                            },
                        },
                        instructions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    step: {
                                        type: 'number',
                                        minimum: 1,
                                    },
                                    text: {
                                        type: 'string',
                                        minLength: 1,
                                        maxLength: 1000,
                                    },
                                    image: {
                                        type: 'string',
                                        format: 'uri',
                                    },
                                    timer: {
                                        type: 'object',
                                        properties: {
                                            duration: {
                                                type: 'number',
                                                minimum: 0,
                                            },
                                            unit: {
                                                type: 'string',
                                                enum: ['minutes', 'hours'],
                                            },
                                        },
                                        required: ['duration', 'unit'],
                                    },
                                },
                                required: ['step', 'text'],
                            },
                        },
                        servings: {
                            type: 'number',
                            minimum: 1,
                        },
                        prepTime: {
                            type: 'number',
                            minimum: 0,
                        },
                        cookTime: {
                            type: 'number',
                            minimum: 0,
                        },
                        difficulty: {
                            type: 'string',
                            enum: ['easy', 'medium', 'hard'],
                        },
                        cuisine: {
                            type: 'string',
                            maxLength: 50,
                        },
                        tags: {
                            type: 'array',
                            items: {
                                type: 'string',
                                maxLength: 50,
                            },
                        },
                        images: {
                            type: 'array',
                            items: {
                                type: 'string',
                                format: 'uri',
                            },
                        },
                        author: {
                            type: 'object',
                            properties: {
                                _id: {
                                    type: 'string',
                                    format: 'ObjectId',
                                },
                                name: {
                                    type: 'string',
                                },
                            },
                            required: ['_id', 'name'],
                        },
                        ratings: {
                            type: 'object',
                            properties: {
                                average: {
                                    type: 'number',
                                    minimum: 0,
                                    maximum: 5,
                                },
                                count: {
                                    type: 'number',
                                    minimum: 0,
                                },
                            },
                            required: ['average', 'count'],
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                    required: [
                        'title',
                        'ingredients',
                        'instructions',
                        'servings',
                        'prepTime',
                        'cookTime',
                        'difficulty',
                        'author',
                    ],
                },
                Timer: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            format: 'ObjectId',
                        },
                        userId: {
                            type: 'string',
                            format: 'ObjectId',
                        },
                        recipeId: {
                            type: 'string',
                            format: 'ObjectId',
                        },
                        groupId: {
                            type: 'string',
                            format: 'ObjectId',
                        },
                        stepNumber: {
                            type: 'number',
                            minimum: 0,
                        },
                        label: {
                            type: 'string',
                        },
                        duration: {
                            type: 'number',
                            minimum: 0,
                        },
                        startTime: {
                            type: 'string',
                            format: 'date-time',
                        },
                        endTime: {
                            type: 'string',
                            format: 'date-time',
                        },
                        remainingTime: {
                            type: 'number',
                            minimum: 0,
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'running', 'paused', 'completed', 'cancelled'],
                        },
                        alerts: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: {
                                        type: 'string',
                                        enum: ['notification', 'sound', 'voice'],
                                    },
                                    time: {
                                        type: 'number',
                                        minimum: 0,
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    sent: {
                                        type: 'boolean',
                                    },
                                },
                                required: ['type', 'time', 'message', 'sent'],
                            },
                        },
                        priority: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                        },
                        notes: {
                            type: 'string',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                    required: ['userId', 'label', 'duration', 'status', 'alerts', 'priority', 'createdAt'],
                },
            },
        },
    },
    apis: ['./src/routes/*.ts'], // Path to the API routes
};
export const swaggerSpec = swaggerJsdoc(options);
//# sourceMappingURL=swagger.js.map