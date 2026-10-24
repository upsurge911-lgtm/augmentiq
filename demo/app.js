document.addEventListener('DOMContentLoaded', () => {
    
    // Define the connections
    const links = [
        { from: 'node-host', to: 'node-mcp' },
        { from: 'node-mcp', to: 'node-validate' },
        { from: 'node-validate', to: 'node-chunk' },
        { from: 'node-chunk', to: 'node-temporal' },
        { from: 'node-temporal', to: 'node-embed' },
        { from: 'node-embed', to: 'node-sqlite' },
        { from: 'node-embed', to: 'node-lance' }
    ];

    const svg = document.getElementById('connections-svg');

    function drawConnections() {
        // Clear existing paths
        svg.innerHTML = '';

        links.forEach(link => {
            const fromNode = document.getElementById(link.from);
            const toNode = document.getElementById(link.to);

            if (!fromNode || !toNode) return;

            // Get positions relative to canvas
            const canvasRect = document.getElementById('canvas').getBoundingClientRect();
            const fromRect = fromNode.getBoundingClientRect();
            const toRect = toNode.getBoundingClientRect();

            // Calculate start (right side of fromNode)
            const startX = (fromRect.right - canvasRect.left);
            const startY = (fromRect.top + fromRect.height / 2 - canvasRect.top);

            // Calculate end (left side of toNode)
            const endX = (toRect.left - canvasRect.left);
            const endY = (toRect.top + toRect.height / 2 - canvasRect.top);

            // Create Bezier curve
            const controlOffset = (endX - startX) * 0.5;
            const d = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('class', 'connection-path');
            
            // Highlight specific active paths for the demo
            if (['node-validate', 'node-chunk'].includes(link.from)) {
                path.classList.add('active');
            }

            svg.appendChild(path);
        });
    }

    // Draw initially and on resize
    drawConnections();
    window.addEventListener('resize', drawConnections);

    // Make nodes interactive
    const nodes = document.querySelectorAll('.node');
    const codeView = document.getElementById('code-view');
    const debugView = document.getElementById('debug-view');

    const nodeData = {
        'host': {
            code: "{\n  \"agent\": \"Claude Desktop\",\n  \"status\": \"waiting\"\n}",
            log: "Host agent initialized."
        },
        'mcp': {
            code: "{\n  \"jsonrpc\": \"2.0\",\n  \"method\": \"mcp_add_memory\"\n}",
            log: "Receiving MCP payload..."
        },
        'validate': {
            code: "{\n  \"schema_check\": \"pass\"\n}",
            log: "Validating schema... OK."
        },
        'chunk': {
            code: "{\n  \"tool\": \"tree-sitter\",\n  \"lang\": \"python\"\n}",
            log: "Executing AST Chunking... 4 semantic blocks found."
        },
        'temporal': {
            code: "{\n  \"valid_time\": \"2026-07-16\",\n  \"ingest_time\": \"NOW\"\n}",
            log: "Applying Bi-temporal logic."
        },
        'embed': {
            code: "{\n  \"model\": \"Nomic\",\n  \"dim\": 384\n}",
            log: "Generating dense vectors..."
        },
        'sqlite': {
            code: "INSERT INTO timeline...",
            log: "Audit log committed securely."
        },
        'lance': {
            code: "table.add(vector)",
            log: "Vectors indexed locally."
        }
    };

    nodes.forEach(node => {
        node.addEventListener('click', () => {
            // Remove active from all
            nodes.forEach(n => n.classList.remove('active'));
            node.classList.add('active');

            // Update panels
            const info = node.getAttribute('data-info');
            if (nodeData[info]) {
                codeView.textContent = nodeData[info].code;
                
                const time = new Date().toISOString().split('T')[1].substring(0, 12);
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry highlight';
                logEntry.innerHTML = `<span class="time">[${time}]</span> ${nodeData[info].log}`;
                debugView.appendChild(logEntry);
                debugView.scrollTop = debugView.scrollHeight;
            }
        });
    });

    // Clear button
    document.querySelector('.clear-btn').addEventListener('click', () => {
        debugView.innerHTML = '';
    });
});

// Sidebar selection
function selectDetail(id) {
    document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
}
