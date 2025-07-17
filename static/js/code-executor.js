/**
 * Interactive Code Execution for nate.green blog
 * Supports Python (via Pyodide) and JavaScript execution
 */

class CodeExecutor {
    constructor() {
        this.pyodideReady = false;
        this.pyodide = null;
        this.initializePyodide();
    }

    async initializePyodide() {
        try {
            console.log('Starting Pyodide initialization...');
            
            // Use a more reliable CDN and version
            const pyodideScript = document.createElement('script');
            pyodideScript.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
            pyodideScript.defer = true;
            document.head.appendChild(pyodideScript);
            
            pyodideScript.onload = async () => {
                try {
                    console.log('Pyodide script loaded, initializing...');
                    
                    // Wait a bit for the script to fully load
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    if (typeof loadPyodide === 'undefined') {
                        throw new Error('loadPyodide function not available');
                    }
                    
                    this.pyodide = await loadPyodide({
                        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
                        fullStdLib: false
                    });
                    
                    this.pyodideReady = true;
                    console.log('Pyodide initialized successfully');
                    this.updatePythonButtons();
                } catch (initError) {
                    console.error('Pyodide initialization failed:', initError);
                    this.handlePyodideError();
                }
            };
            
            pyodideScript.onerror = (error) => {
                console.error('Failed to load Pyodide script:', error);
                this.handlePyodideError();
            };
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (!this.pyodideReady) {
                    console.error('Pyodide loading timed out');
                    this.handlePyodideError();
                }
            }, 30000);
            
        } catch (error) {
            console.error('Failed to setup Pyodide:', error);
            this.handlePyodideError();
        }
    }

    handlePyodideError() {
        const pythonButtons = document.querySelectorAll('[data-lang="python"] .run-button, .language-python + .executable-code-block .run-button');
        pythonButtons.forEach(button => {
            button.textContent = '❌ Python Failed';
            button.disabled = true;
            button.title = 'Python environment failed to load';
        });
    }

    updatePythonButtons() {
        const pythonButtons = document.querySelectorAll('[data-lang="python"] .run-button');
        pythonButtons.forEach(button => {
            button.disabled = false;
            button.textContent = '▶ Run Python';
        });
    }

    async executeCode(code, language, outputElement) {
        try {
            let result;
            
            switch (language.toLowerCase()) {
                case 'javascript':
                case 'js':
                    result = this.executeJavaScript(code);
                    break;
                case 'python':
                case 'py':
                    if (!this.pyodideReady) {
                        throw new Error('Python environment not ready. Please wait...');
                    }
                    result = await this.executePython(code);
                    break;
                default:
                    throw new Error(`Language "${language}" not supported`);
            }
            
            this.displayResult(outputElement, result, 'success');
        } catch (error) {
            this.displayResult(outputElement, error.message, 'error');
        }
    }

    executeJavaScript(code) {
        // Capture console output
        const originalLog = console.log;
        const logs = [];
        
        console.log = (...args) => {
            logs.push(args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '));
        };
        
        try {
            // Execute the code
            const result = eval(code);
            console.log = originalLog;
            
            // Return logs and result
            const output = logs.length > 0 ? logs.join('\n') : '';
            const returnValue = result !== undefined ? String(result) : '';
            
            return output + (output && returnValue ? '\n' : '') + returnValue;
        } catch (error) {
            console.log = originalLog;
            throw error;
        }
    }

    async executePython(code) {
        try {
            // Redirect Python stdout to capture print statements
            this.pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
            `);
            
            // Execute the user code
            const result = this.pyodide.runPython(code);
            
            // Get the captured output
            const stdout = this.pyodide.runPython('sys.stdout.getvalue()');
            
            // Reset stdout
            this.pyodide.runPython(`
sys.stdout = sys.__stdout__
            `);
            
            // Return output and result
            const output = stdout ? stdout.trim() : '';
            const returnValue = result !== undefined && result !== null ? String(result) : '';
            
            return output + (output && returnValue ? '\n' : '') + returnValue;
        } catch (error) {
            // Reset stdout on error
            this.pyodide.runPython('sys.stdout = sys.__stdout__');
            throw error;
        }
    }

    displayResult(outputElement, result, type) {
        outputElement.style.display = 'block';
        outputElement.className = `code-output ${type}`;
        
        // Terminal-style output
        const prefix = type === 'error' ? '❌ ' : '✓ ';
        outputElement.textContent = prefix + result;
        
        // Auto-hide success messages after 10 seconds
        if (type === 'success') {
            setTimeout(() => {
                outputElement.style.opacity = '0.7';
            }, 10000);
        }
    }

    createExecutableCodeBlock(codeElement) {
        const language = codeElement.getAttribute('data-lang') || 'javascript';
        const code = codeElement.textContent;
        
        // Find the parent highlight div
        const highlightDiv = codeElement.closest('.highlight');
        if (!highlightDiv) return;
        
        // Create container
        const container = document.createElement('div');
        container.className = 'executable-code-block';
        
        // Create header with run button
        const header = document.createElement('div');
        header.className = 'code-header';
        
        const languageLabel = document.createElement('span');
        languageLabel.className = 'language-label';
        languageLabel.textContent = language.toUpperCase();
        
        const runButton = document.createElement('button');
        runButton.className = 'run-button';
        runButton.textContent = language === 'python' && !this.pyodideReady ? 
            '⏳ Loading Python...' : `▶ Run ${language}`;
        runButton.disabled = language === 'python' && !this.pyodideReady;
        
        header.appendChild(languageLabel);
        header.appendChild(runButton);
        
        // Create output area
        const output = document.createElement('div');
        output.className = 'code-output';
        output.style.display = 'none';
        
        // Wire up the execution
        runButton.addEventListener('click', async () => {
            runButton.disabled = true;
            runButton.textContent = '⏳ Running...';
            
            await this.executeCode(code, language, output);
            
            runButton.disabled = false;
            runButton.textContent = `▶ Run ${language}`;
        });
        
        // Insert the interactive elements after the highlight div
        highlightDiv.parentNode.insertBefore(container, highlightDiv.nextSibling);
        container.appendChild(header);
        container.appendChild(output);
        
        // Mark the highlight div as processed
        highlightDiv.setAttribute('data-executable', 'true');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const executor = new CodeExecutor();
    
    // Find code blocks within highlight divs (Hugo's syntax highlighting)
    const highlightDivs = document.querySelectorAll('.highlight');
    
    highlightDivs.forEach(highlightDiv => {
        const codeElement = highlightDiv.querySelector('code[data-lang]');
        if (codeElement) {
            const language = codeElement.getAttribute('data-lang');
            if (language === 'javascript' || language === 'python') {
                // Skip if already processed
                if (highlightDiv.getAttribute('data-processed') === 'true') return;
                
                executor.createExecutableCodeBlock(codeElement);
                highlightDiv.setAttribute('data-processed', 'true');
            }
        }
    });
    
    // Also check for standalone code blocks
    const standaloneCodeBlocks = document.querySelectorAll('code[data-executable="true"]');
    standaloneCodeBlocks.forEach(block => {
        if (block.getAttribute('data-processed') === 'true') return;
        executor.createExecutableCodeBlock(block);
        block.setAttribute('data-processed', 'true');
    });
});