"use strict";
// NOTE: Product IDs for plans are set in src/app/page.tsx and src/app/api/webhook/route.ts. Update them there if you change plans in Polar.
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLAR_CONFIG = exports.PLAN_CONFIGS = exports.CHECKOUT_CANCEL_URL = exports.CHECKOUT_SUCCESS_URL = exports.DEPLOYMENT_CHECKLIST = exports.validateEnvironment = exports.getPolarConfig = exports.getCurrentEnvironment = exports.getPlanById = exports.getPlanByProductId = exports.PLANS = exports.PLAN_LIMITS = exports.getProductIds = exports.PRODUCT_IDS = void 0;
// Environment-aware configuration for different deployment stages
const ENV_CONFIG = {
    development: {
        polar: {
            baseUrl: 'https://sandbox-api.polar.sh',
            dashboardUrl: 'https://sandbox.polar.sh'
        }
    },
    sandbox: {
        polar: {
            baseUrl: 'https://sandbox-api.polar.sh',
            dashboardUrl: 'https://sandbox.polar.sh'
        }
    },
    production: {
        polar: {
            baseUrl: 'https://api.polar.sh',
            dashboardUrl: 'https://polar.sh'
        }
    }
};
// Determine current environment
const currentEnv = process.env.NODE_ENV === 'production'
    ? (process.env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox')
    : 'development';
// Product IDs for different environments
exports.PRODUCT_IDS = {
    sandbox: {
        basic: "5ee6ffad-ea07-47bf-8219-ad7b77ce4e3f",
        pro: "a0cb28d8-e607-4063-b3ea-c753178bbf53"
    },
    production: {
        // TODO: Update these when moving to production
        basic: "soon",
        pro: "soon"
    }
};
// Get product IDs for current environment
const getProductIds = () => {
    if (currentEnv === 'production') {
        return exports.PRODUCT_IDS.production;
    }
    return exports.PRODUCT_IDS.sandbox;
};
exports.getProductIds = getProductIds;
const currentProductIds = (0, exports.getProductIds)();
const config = ENV_CONFIG[currentEnv];
exports.PLAN_LIMITS = {
    free: {
        creditsPerMonth: 60,
        features: ['basic_processing', 'standard_quality']
    },
    basic: {
        creditsPerMonth: 1800,
        features: ['basic_processing', 'standard_quality', 'priority_support']
    },
    pro: {
        creditsPerMonth: 6000,
        features: ['basic_processing', 'standard_quality', 'priority_support', 'advanced_features', 'bulk_processing']
    }
};
exports.PLANS = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        credits: 60,
        features: [
            '60 minutes of video processing',
            'Standard AI summaries',
            'Basic video insights',
            'Community support'
        ],
        productId: '',
        checkoutUrl: ''
    },
    {
        id: 'basic',
        name: 'Basic',
        price: 9,
        credits: 1800,
        features: [
            '1,800 minutes of video processing',
            'Advanced AI summaries',
            'Detailed video insights',
            'Priority email support',
            'Export summaries'
        ],
        productId: currentProductIds.basic,
        checkoutUrl: `${config.polar.baseUrl}/checkouts/custom?product_id=${currentProductIds.basic}`,
        popular: true
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 15,
        credits: 6000,
        features: [
            '6,000 minutes of video processing',
            'Premium AI summaries',
            'Advanced analytics',
            'Priority support',
            'API access',
            'Bulk processing',
            'Custom integrations'
        ],
        productId: currentProductIds.pro,
        checkoutUrl: `${config.polar.baseUrl}/checkouts/custom?product_id=${currentProductIds.pro}`
    }
];
// Helper functions for production deployment
const getPlanByProductId = (productId) => {
    return exports.PLANS.find(plan => plan.productId === productId) || null;
};
exports.getPlanByProductId = getPlanByProductId;
const getPlanById = (id) => {
    return exports.PLANS.find(plan => plan.id === id) || null;
};
exports.getPlanById = getPlanById;
const getCurrentEnvironment = () => currentEnv;
exports.getCurrentEnvironment = getCurrentEnvironment;
const getPolarConfig = () => config.polar;
exports.getPolarConfig = getPolarConfig;
// Environment validation
const validateEnvironment = () => {
    const requiredEnvVars = [
        'POLAR_ACCESS_TOKEN',
        'POLAR_WEBHOOK_SECRET',
        'DATABASE_URL'
    ];
    const missing = requiredEnvVars.filter(env => !process.env[env]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    console.log(`🌍 Environment: ${currentEnv}`);
    console.log(`🔗 Polar API: ${config.polar.baseUrl}`);
    console.log(`📦 Product IDs: Basic=${currentProductIds.basic}, Pro=${currentProductIds.pro}`);
};
exports.validateEnvironment = validateEnvironment;
// Production deployment checklist
exports.DEPLOYMENT_CHECKLIST = {
    sandbox: [
        'Set POLAR_ENVIRONMENT=sandbox',
        'Use sandbox product IDs',
        'Test all payment flows',
        'Verify webhook endpoints'
    ],
    production: [
        'Set POLAR_ENVIRONMENT=production',
        'Update product IDs in PRODUCT_IDS.production',
        'Set production webhook URL',
        'Verify SSL certificates',
        'Test with real payments'
    ]
};
// Payment URLs
exports.CHECKOUT_SUCCESS_URL = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/success`;
exports.CHECKOUT_CANCEL_URL = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/failure`;
exports.PLAN_CONFIGS = exports.PLANS;
// Polar environment configuration
exports.POLAR_CONFIG = {
    server: process.env.POLAR_SERVER || 'sandbox', // 'sandbox' for testing, 'production' for live
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
};
// Functions moved above to avoid duplicates 
