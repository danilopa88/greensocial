import sys
content = open('public/index.html', 'r', encoding='utf-8').read()

modal = """
    <!-- Modal: Enviar Comunicado (Newsletter) -->
    <div id="modal-newsletter" class="modal-overlay">
        <div class="modal-content" style="max-width: 560px;">
            <button class="modal-close" id="btn-close-newsletter"><i class="fa-solid fa-xmark"></i></button>
            <h2><i class="fa-solid fa-envelope" style="color:#6366f1;"></i> Enviar Comunicado</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">O comunicado sera enviado para todos os voluntarios <strong>Ativos</strong> cadastrados.</p>
            <div class="form-group">
                <label for="newsletter-subject">Assunto</label>
                <input type="text" id="newsletter-subject" placeholder="Ex: Reuniao mensal de voluntarios">
            </div>
            <div class="form-group">
                <label for="newsletter-message">Mensagem</label>
                <textarea id="newsletter-message" class="edit-post-textarea" style="min-height: 160px; resize: vertical;" placeholder="Escreva aqui o conteudo do comunicado..."></textarea>
            </div>
            <div id="newsletter-recipients-info" style="padding: 0.75rem 1rem; background: #f0fdf4; border-radius: 8px; font-size: 0.875rem; color: #166534; margin-bottom: 1.5rem;"></div>
            <div id="newsletter-feedback" style="display: none; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1rem;"></div>
            <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button class="btn-secondary" id="btn-cancel-newsletter">Cancelar</button>
                <button class="btn-primary" id="btn-confirm-newsletter" style="background: #6366f1; box-shadow: 0 4px 10px rgba(99,102,241,0.25);">
                    <i class="fa-solid fa-paper-plane"></i> Enviar Comunicado
                </button>
            </div>
        </div>
    </div>
"""

content = content.replace('</body>', modal + '\n</body>')
open('public/index.html', 'w', encoding='utf-8').write(content)
print('Done')
