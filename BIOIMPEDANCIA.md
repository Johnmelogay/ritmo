# Importação de bioimpedância

Em **Evolução → Importar exame**, escolha Screenshot, Colar texto ou Preencher. O leitor OCR roda no dispositivo usando Tesseract.js; carrega o motor e os modelos de idioma pela internet no primeiro uso. Fotos não são enviadas ao Gemini/OpenAI neste fluxo. PNG, JPG e WebP são aceitos, até 12 MB; PDFs e HEIC ainda precisam ser convertidos.

Após a extração, confira os resultados com a imagem e confirme a revisão. Sem peso e data válida o registro não é salvo. Quando a data não puder ser lida, ela fica em branco; o app não presume a data do upload. Documentos com várias datas ou resultados ambíguos exigem revisão. O leitor tenta reconhecer rótulos explícitos em português/inglês; layouts em colunas podem exigir preenchimento manual.

O registro guarda data e horário do exame, resultados, aparelho, origem, texto reconhecido, nome do arquivo e data de importação. A imagem fica apenas na prévia temporária e não é preservada no backup. Uma leitura OCR não é garantia de precisão.

O perfil corporal e o relatório são derivados do mesmo histórico salvo: data do exame, horário e, em caso de empate, data de importação determinam a ordem. Importar um exame antigo atualiza o histórico na data correta, sem substituir a avaliação atual. Uma pesagem posterior não apaga os resultados da última bioimpedância. Metas de dieta/treino não são alteradas pela importação.

Reimportação na mesma data, horário e aparelho exige escolher substituir o registro existente; um exame distinto pode ser identificado por horário ou aparelho. O relatório aparece em Evolução, no Perfil e no calendário na data da avaliação. O CSV e o backup JSON incluem os resultados e sua origem. Sem Firebase configurado, os registros ficam no navegador; com uma conta configurada, usam o fluxo de sincronização existente, que ainda depende do provisionamento e validação de produção.

Massa muscular, massa muscular esquelética, massa de gordura e massa livre de gordura são campos distintos. Ausência de um resultado não é preenchida com uma estimativa.

O backend Gemini/Jev, o fallback OpenAI e o armazenamento permanente de laudos permanecem pendentes da implementação/configuração descrita na conversa. Este recurso de OCR local pode ser usado sem chaves de IA.
