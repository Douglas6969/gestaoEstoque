export default {
    apps: [{
        name: "gestaoEstoque-frontend",
        script: "./server.js",
        instances: 1,
        env: {
            NODE_ENV: "production",
            PORT: 5173
        }
    }]
};
