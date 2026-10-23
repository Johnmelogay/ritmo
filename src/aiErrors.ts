export async function providerResponseError(response: Response): Promise<Error> {
 if(response.status===415)return new Error('DeepSeek não recebe áudio nem HEIC. Use o ditado do teclado para enviar texto, ou uma imagem JPEG/PNG/WebP.');
 if(response.status===402)return new Error('O saldo do DeepSeek está esgotado. Adicione créditos no painel DeepSeek. Nenhuma alteração foi executada.');
 if(response.status===429)return new Error('O limite de solicitações da IA foi atingido. Aguarde um pouco e tente novamente.');
 if(response.status===401||response.status===403)return new Error('O serviço de IA recusou o acesso. Confira a conta, o consentimento e a configuração do backend.');
 if(response.status===504)return new Error('DeepSeek demorou para responder. Tente novamente; nenhum outro provedor foi acionado.');
 return new Error(`O serviço de IA não concluiu a solicitação (${response.status}). Nenhuma alteração foi executada.`);
}
