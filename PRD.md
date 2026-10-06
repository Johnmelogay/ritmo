# PRD — Gestor Inteligente de Treino e Nutrição

**Versão:** 1.1 para revisão  
**Data:** 06/10/2026  
**Idioma do produto:** português brasileiro  
**Plataforma principal:** PWA para iPhone, publicada no GitHub Pages  
**Status:** especificação; desenvolvimento depende da aprovação deste PRD

## 1. Resumo executivo

O produto é um gestor pessoal de treino, alimentação e evolução corporal. Ele registra com precisão o que foi planejado e realizado, aprende a rotina e recomenda pequenos ajustes para aproximar o usuário de uma meta física definida. A experiência diária deve ser rápida e familiar: Home estável, registro de refeições por foto/texto/áudio em poucos toques, calendário com relatórios por dia, treino do dia evidente e uma próxima ação útil. A inteligência opera sobre dados verificáveis, contexto de rotina e uma base científica versionada.

O aplicativo combina três origens de planejamento: **profissional**, **IA** e **usuário**. A autoria permanece visível em cada exercício, meta e alteração. O plano do profissional é preservado como referência; uma sessão executada pode incluir adaptações da IA e escolhas do usuário. O sistema avalia, ao longo do tempo, aderência, desempenho e recuperação associados a essas escolhas, sem afirmar causalidade onde há apenas correlação.

O frontend será estático no GitHub Pages; Firebase fornecerá autenticação, banco, armazenamento e funções protegidas para Gemini e Jev. Os dois repositórios existentes servirão como referência funcional e fontes de migração: [Desafio40days](https://github.com/Johnmelogay/Desafio40days) e [Gym-companion](https://github.com/Johnmelogay/Gym-companion).

## 2. Problema e oportunidade

Aplicativos tradicionais registram calorias e treinos, mas normalmente exigem que o usuário interprete sozinho um dia perdido, uma mudança de rotina, uma queda de rendimento ou uma refeição fora do plano. Uma adaptação útil precisa considerar simultaneamente meta, tendência de peso, nutrição, treino, recuperação, tempo disponível e preferências reais.

O objetivo é responder diariamente: **“Diante do que aconteceu e do que é viável amanhã, qual é a próxima ação que mais ajuda o objetivo sem tornar a rotina difícil de sustentar?”**

### Princípios do produto

1. **Objetivo estável, caminho adaptável.** A meta e as restrições são definidas pelo usuário; o plano diário pode mudar dentro delas.
2. **Registro primeiro.** Treinos, alimentos e medidas continuam utilizáveis quando os serviços de IA falham.
3. **Padrões antes de intervenções.** Uma ocorrência isolada não redefine calorias, volume ou rotina.
4. **Sugestões executáveis.** Toda recomendação indica ação, razão, dados usados e possibilidade de recusa ou edição.
5. **Autoria e histórico preservados.** Plano-base, adaptação proposta e execução real são registros diferentes.
6. **Controle proporcional.** Ajustes pequenos podem ser preaprovados pelo usuário; mudanças estruturais exigem confirmação explícita.
7. **Incerteza visível.** Estimativas de calorias, composição corporal e resposta individual não são apresentadas como medições exatas.
8. **Privacidade por padrão.** Somente os dados necessários para uma função são enviados ao respectivo serviço.

## 3. Público e casos de uso

### Público inicial

Adultos que praticam musculação e querem gerir treino, dieta e composição corporal no mesmo lugar, começando pelo uso pessoal do proprietário do projeto. A arquitetura deve permitir contas individuais futuramente.

### Atores

| Ator | Necessidade | Permissão inicial |
|---|---|---|
| Usuário | Registrar, planejar, revisar e exportar seus dados | Dono integral dos próprios dados |
| Personal trainer | Fornecer plano de treino | Plano inserido/importado pelo usuário; portal profissional é fase posterior |
| Nutricionista | Fornecer metas ou plano alimentar | Metas inseridas/importadas pelo usuário; portal profissional é fase posterior |
| Motor adaptativo | Propor ajustes | Sem permissão de alterar planos protegidos ou metas estruturais sozinho |

### Jornadas prioritárias

1. Primeiro acesso: criar conta, definir objetivo, registrar restrições e disponibilidade, cadastrar/importar treino do personal e metas nutricionais.
2. Manhã: ver Home, registrar peso e recuperação, consultar treino e refeições planejadas.
3. Refeição: buscar alimento, informar quantidade, conferir fonte nutricional, salvar e atualizar totais.
4. Treino: iniciar sessão, registrar séries, usar timer, adicionar ou substituir exercício, encerrar e avaliar esforço.
5. Fim do dia: revisar o que ocorreu e receber plano de amanhã compatível com o objetivo e a rotina.
6. Fim da semana: observar tendências, aceitar ou rejeitar ajustes estruturais e exportar relatórios.
7. Migração: importar backup dos protótipos, conferir prévia, resolver conflitos e confirmar importação.

## 4. Objetivos, resultados e limites de escopo

### Objetivos do produto

- Reunir alimentação, treino, recuperação e composição corporal em um histórico confiável.
- Reduzir o esforço para registrar refeições e séries no iPhone.
- Adaptar o dia seguinte quando houver mudanças na execução ou na agenda.
- Aprender horários, preferências, disposição e tolerância ao plano.
- Preservar a intenção de planos profissionais e medir os desvios da execução.
- Oferecer relatórios completos em CSV e backup portátil.
- Fundamentar recomendações em evidência científica rastreável.

### Indicadores de sucesso propostos

Os valores numéricos serão fixados após a linha de base do piloto. A métrica não deve incentivar registro excessivo ou restrição alimentar.

| Indicador | Definição | Leitura desejada |
|---|---|---|
| Aderência de registro | Dias com registros suficientes para uma análise, entre dias de uso | Crescimento sem aumento de atrito |
| Conclusão de treino | Sessões iniciadas e finalizadas com séries salvas | Alta confiabilidade operacional |
| Tempo de registro | Mediana para inserir refeição frequente e série | Baixo no iPhone |
| Utilidade da recomendação | Recomendações aceitas e avaliadas como úteis | Tendência crescente |
| Taxa de reversão | Ajustes aceitos e desfeitos em até sete dias | Tendência decrescente |
| Aderência ao plano | Execução em relação ao plano escolhido | Interpretada junto com bem-estar |
| Qualidade de dados | Registros com unidade, fonte e validação | Alta cobertura |
| Segurança | Acessos indevidos, segredos expostos, sugestões fora das regras | Zero incidentes conhecidos |

### Fora do escopo da primeira versão

- Diagnóstico médico, tratamento de doenças ou prescrição de medicamentos.
- Estimativa automática precisa de calorias gastas pelo exercício.
- Ajuste de treino baseado apenas em foto corporal.
- Integração automática com Apple Health, relógios, balanças ou aparelhos de bioimpedância.
- Portal colaborativo para personal e nutricionista.
- Compra de alimentos, assinatura, rede social ou gamificação competitiva.

Esses itens podem ser considerados depois que registro, sincronização e adaptação forem confiáveis.

## 5. Requisitos funcionais

Prioridades: **P0** essencial para a primeira versão utilizável; **P1** essencial para o produto completo; **P2** evolução posterior.

### 5.1 Conta, perfil e objetivo

| ID | Prioridade | Requisito |
|---|---|---|
| PERF-01 | P0 | Criar conta, entrar, sair e recuperar acesso com Firebase Authentication. |
| PERF-02 | P0 | Perfil com idade/faixa etária, altura, peso inicial, fuso, objetivo, experiência e disponibilidade semanal. Dados como sexo biológico serão solicitados somente quando uma fórmula exigir. |
| PERF-03 | P0 | Objetivo versionado com métrica principal, horizonte, prioridades e limites de mudança. |
| PERF-04 | P0 | Restrições alimentares, alergias, limitações de movimento e preferências; campos opcionais sensíveis identificados. |
| PERF-05 | P1 | Consentimentos separados para extração de documentos, recomendações com IA e aprendizado da rotina. |
| PERF-06 | P1 | Histórico de metas; alterações de objetivo não reescrevem metas antigas nem reinterpretam retroativamente o desempenho. |

### 5.2 Home e navegação

**Estrutura fixa; conteúdo atualizado.** A posição dos módulos principais permanece previsível. A IA pode alterar mensagens, prioridades e ações dentro de espaços delimitados.

Ordem padrão:

1. Cabeçalho “Hoje”, data local e objetivo ativo.
2. Meta do dia: energia, proteína, demais macros, água e atividade quando relevante.
3. Próxima melhor ação: no máximo uma ação principal e duas secundárias.
4. Alimentação: refeições realizadas/próximas e botão único de registro por foto, texto, áudio ou entrada manual.
5. Treino do dia: grupo muscular, origem, duração estimada e ação “Iniciar”.
6. Recuperação: sono, energia, dores e disponibilidade.
7. Linha do tempo do dia e acesso direto ao calendário.

Navegação inferior: **Hoje, Alimentação, Treino, Progresso, Perfil**. Todas as métricas e cartões abrem a visão detalhada correspondente. A Home deve permitir concluir tarefas frequentes sem percorrer menus profundos.

| ID | Prioridade | Requisito |
|---|---|---|
| HOME-01 | P0 | Exibir estado de hoje, data e progresso com valores reais, meta e unidade. |
| HOME-02 | P0 | Ações rápidas de registrar alimento, peso, recuperação e iniciar treino. |
| HOME-03 | P0 | Mostrar treino definido pelo personal como referência quando existir. |
| HOME-04 | P1 | Mostrar recomendação contextual com “Por quê?”, “Aceitar”, “Editar” e “Dispensar”. |
| HOME-05 | P1 | Configurar visibilidade de cartões sem permitir que a IA reorganize a Home sozinha. |
| HOME-06 | P1 | Indicar dados desatualizados, registros pendentes de sincronização e estimativas. |
| HOME-07 | P0 | O cartão de alimentação abre imediatamente as opções Foto, Texto, Áudio e Manual. |
| HOME-08 | P0 | A data abre o calendário no dia selecionado, preservando o contexto da Home. |

### 5.3 Nutrição

| ID | Prioridade | Requisito |
|---|---|---|
| NUT-01 | P0 | Registro de refeições e alimentos por g, ml ou porção com conversão explícita. |
| NUT-02 | P0 | Cálculo determinístico de kcal, proteína, carboidratos e gorduras; totais por refeição, dia e semana. |
| NUT-03 | P0 | Favoritos, alimentos personalizados, copiar refeição e edição retroativa auditável. |
| NUT-04 | P1 | Catálogo brasileiro com fonte por item; TACO como fonte inicial; verificar termos da TBCA antes de integrar sua base. |
| NUT-05 | P1 | Receitas com ingredientes, rendimento e nutrição por porção. |
| NUT-06 | P1 | Planejamento de refeições, lista de compras e ajustes à agenda. |
| NUT-07 | P1 | Água, fibras, sódio e outros nutrientes somente quando o alimento tiver dados confiáveis. |
| NUT-08 | P1 | Leitura de código de barras e conferência da informação importada. |
| NUT-09 | P1 | Gemini interpreta foto, texto ou áudio de refeição como rascunho; usuário confirma alimentos e quantidades antes do registro. |
| NUT-10 | P1 | Metas por dia e tipo de dia (treino/descanso), com alterações versionadas. |
| NUT-11 | P1 | Capturar foto da câmera ou galeria, descrição digitada ou mensagem de voz em um mesmo fluxo de registro. |
| NUT-12 | P1 | Permitir combinar modalidades: foto + fala/texto + peso informado + rótulo/receita. |
| NUT-13 | P1 | Apresentar estimativa central e faixa plausível para kcal e macros quando porção/ingredientes forem incertos, com motivo da incerteza. |
| NUT-14 | P1 | Fazer até duas perguntas curtas sobre os fatores que mais mudam a estimativa, como quantidade, óleo, molhos, bebida e método de preparo. |
| NUT-15 | P1 | Aprender refeições e porções confirmadas pelo usuário para acelerar registros futuros, mantendo edição e fonte visíveis. |

**Regra de precisão:** valor nutricional ausente aparece como “não informado”; a IA não preenche um número como se fosse medido. Estimativas são marcadas, com fonte e possibilidade de ajuste.

#### Fluxo de registro multimodal

1. O usuário toca em **Registrar refeição** e escolhe foto, texto, áudio ou entrada manual. É possível anexar uma segunda modalidade no mesmo rascunho, por exemplo foto e “arroz 120 g, frango 180 g, uma colher de azeite”.
2. Gemini identifica itens candidatos, preparo e informações declaradas. Para áudio, extrai a descrição da fala e mostra a transcrição editável; a voz nunca vira um registro definitivo sem revisão.
3. O sistema tenta associar cada item a alimento, receita ou rótulo conhecido. Prioridade de informação: quantidade pesada e rótulo/receita do usuário; item validado de catálogo; medida caseira declarada; estimativa visual de porção. A fonte e a versão da composição nutricional ficam no registro.
4. O motor faz uma passagem de revisão inspirada no **método de recordatório alimentar de múltiplas passagens**: verifica itens esquecidos, detalhes do preparo e porções. No uso diário, isso aparece apenas como uma ou duas perguntas de maior impacto, não como entrevista longa. O método original foi validado para recordatórios de 24 horas; nossa adaptação para registro imediato precisará de validação própria. [Estudo do método USDA](https://pubmed.ncbi.nlm.nih.gov/18689367/).
5. O cálculo de nutrientes é determinístico: quantidade confirmada × composição da fonte, respeitando rendimento e porção de receitas. Para peso incerto, calcula-se uma faixa com limites plausíveis para os ingredientes/porções não observados, em vez de inventar precisão decimal.
6. A tela de revisão mostra itens, quantidades, kcal/macros, faixa de incerteza e pergunta pendente. O usuário ajusta, salva ou escolhe “salvar como estimativa”. A confirmação alimenta a memória de refeições frequentes.

**Estimador proposto:** para itens sem peso medido, gerar hipóteses explícitas de porção (por exemplo, 100–150 g de arroz cozido), ajustadas pelas medidas caseiras e porções anteriormente confirmadas pelo próprio usuário. Diferenciar cru/cozido e rendimento de preparo. Calcular kcal/macros de cada hipótese usando uma fonte nutricional identificada; propagar as faixas de quantidade e composição até o total da refeição. O valor central não será a saída numérica livre do Gemini: ele resulta de hipóteses rastreáveis. Mais tarde, se houver conjunto de validação suficiente, distribuições de porção e intervalos probabilísticos poderão ser calibrados; antes disso, apresentar apenas **faixa plausível**, sem atribuir probabilidade estatística indevida.

**Hierarquia de confiabilidade:** pesado e rótulo conferido → receita conhecida → porção declarada → medida caseira → fotografia isolada. A foto pode ajudar a identificar componentes, mas uma imagem única não revela com segurança óleo usado, recheios ou massa da porção. Uma revisão sistemática identificou erros relevantes em avaliação alimentar por imagens; o produto deve medir esse erro com refeições de referência antes de prometer precisão. [Revisão e meta-análise](https://pubmed.ncbi.nlm.nih.gov/32839035/) e [revisão sobre estimativa de porções](https://pubmed.ncbi.nlm.nih.gov/31999347/).

**Tratamento de incerteza:** a faixa exibida vem de hipóteses explícitas de porção e ingredientes, não de um “percentual de confiança” arbitrário do modelo. Se não houver base suficiente para uma faixa defensável, mostrar “quantidade necessária” e solicitar dado adicional. A contribuição estimada aparece separada da parte confirmada no total do dia. O usuário pode marcar óleo/molho desconhecido e atualizar depois. Estimativas não disparam ajustes automáticos agressivos de calorias.

**Validação do estimador:** montar amostras de refeições brasileiras pesadas, incluindo pratos mistos, frituras, óleo invisível, bebidas e alimentos embalados. Comparar estimativas antes e depois das perguntas com os valores de referência: erro absoluto e viés de kcal/proteína/carboidrato/gordura, estratificados por modalidade e tipo de refeição. Definir limiares de aceitação antes do piloto e testar também tempo de registro e frequência de correções. Onde a precisão for insuficiente, o produto pede peso/medida ou registra “estimativa de baixa qualidade”.

**Privacidade e operação:** áudio/foto só são enviados ao backend com consentimento; limitar duração/tamanho, retirar metadados desnecessários da imagem e permitir descartar o arquivo após a extração. Quando offline, o rascunho é salvo localmente e processado com IA quando a rede voltar, ou pode ser preenchido manualmente. A transcrição/visão dependem do serviço Gemini ou adaptador equivalente no backend; a plataforma oferece processamento de áudio e imagem. [Áudio](https://ai.google.dev/gemini-api/docs/audio) e [imagem](https://ai.google.dev/gemini-api/docs/image-understanding).

### 5.4 Treino e atividade

| ID | Prioridade | Requisito |
|---|---|---|
| TRE-01 | P0 | Plano de treino com dias, grupo muscular, exercícios, ordem, séries, repetições, descanso e observações. |
| TRE-02 | P0 | Plano-base do personal com autor, versão, validade e marcação de trechos protegidos. |
| TRE-03 | P0 | Sessão planejada como cópia da versão pertinente do plano; edição da sessão não modifica o plano-base. |
| TRE-04 | P0 | Séries executadas com carga em kg, repetições, RPE ou RIR, estado e observações. |
| TRE-05 | P0 | Timer de descanso com duração editável e recomposição correta após bloquear/reabrir o iPhone. |
| TRE-06 | P0 | Adicionar, substituir, pular ou reordenar exercício durante a sessão, com origem e motivo. |
| TRE-07 | P0 | Registrar exercício adicionado pelo usuário ou pela IA sem perder vínculo com a sessão e plano-base. |
| TRE-08 | P1 | Histórico por exercício, melhores marcas, estimativa de 1RM identificada e gráficos de carga/repetição. |
| TRE-09 | P1 | Volume semanal por músculo, diferenciando séries diretas e indiretas conforme regra documentada. |
| TRE-10 | P1 | Suporte a aquecimento, supersets, dropsets, cardio e sessões interrompidas. |
| TRE-11 | P1 | Sugestões de progressão, ajuste de descanso, volume e deload dentro das restrições. |
| TRE-12 | P1 | Avaliar exercício opcional após repetidas exposições; oferecer promovê-lo ao plano fixo mediante aprovação. |

**Proveniência:** azul = profissional, roxo = IA, verde = usuário. Cada cor virá sempre acompanhada por texto e ícone. A origem é registrada no nível do exercício e da alteração, pois uma mesma sessão pode combinar as três.

**Avaliação de adições:** registrar frequência, conclusão, progressão, RPE/RIR, dor, preferência, tempo consumido e recuperação posterior. O relatório apresentará associações observadas e limitações; não atribuirá causalidade automaticamente.

### 5.5 Corpo e recuperação

| ID | Prioridade | Requisito |
|---|---|---|
| COR-01 | P0 | Peso corporal com data/hora, unidade, origem e condições opcionais. |
| COR-02 | P0 | Medidas corporais em cm, com lado quando aplicável. |
| COR-03 | P0 | Bioimpedância manual: peso, gordura, massa gorda, massa livre de gordura, músculo, água e métricas disponíveis, preservando o nome usado pelo aparelho. |
| COR-04 | P1 | Anexar laudo/foto; extração assistida por Gemini com revisão campo a campo antes do salvamento. |
| COR-05 | P1 | Guardar equipamento, horário, hidratação, exercício recente e notas para contextualizar avaliações. |
| COR-06 | P0 | Registrar sono, energia, dor muscular, estresse e fome em escala simples, todos opcionais. |
| COR-07 | P1 | Mostrar tendência de peso e medidas sem inferir mudança de gordura a partir de uma medição isolada. |

### 5.6 Relatórios, exportação e migração

#### Calendário e relatório de cada dia

O calendário mensal mostra todos os dias do período, com marcadores para **alimentação**, **treino**, **peso/corpo** e **recuperação**. Um dia sem registro é “sem dados”; não é automaticamente “falha”. Dia de descanso planejado recebe indicação própria. Registros parciais são distintos de dias fechados/revisados. Filtros permitem ver somente dias com refeições, treino, avaliações ou sugestões aceitas. A navegação é por mês, com retorno rápido a “Hoje”.

Ao tocar em uma data, abre-se o **relatório do dia**: refeições e totais com porção confirmada/estimada, treino planejado versus executado, alterações por origem, peso/sono/energia disponíveis, sugestões recebidas, sincronização e completude do registro. Da mesma tela, o usuário pode corrigir um lançamento e voltar ao calendário sem perder a posição.

A seção **“Como este dia contribuiu para o objetivo”** relaciona o dia à semana, ao mês e ao ciclo da meta: ingestão registrada em relação à meta, proteína acumulada, sessões e séries planejadas versus executadas, tendência de peso e previsão apenas quando houver dados suficientes. Ela mostra o denominador e dias faltantes; não trata ausência de log como zero. Para meta de déficit, apresenta **ingestão versus meta planejada** e tendência corporal, sem afirmar um “déficit real” diário como se o gasto energético fosse medido. O relatório semanal explicita se uma estimativa depende de refeições incompletas.

| ID | Prioridade | Requisito |
|---|---|---|
| CAL-01 | P0 | Calendário mensal com marcação distinta para alimentação, treino, peso/corpo, recuperação, descanso planejado, dia parcial e dia revisado. |
| CAL-02 | P0 | Selecionar qualquer dia com registros e abrir relatório cronológico e editável. |
| CAL-03 | P1 | Comparar o dia à semana, ao mês e ao ciclo da meta com dados de completude e unidade. |
| CAL-04 | P1 | Exibir plano versus execução e contribuições de profissional, IA e usuário no treino daquele dia. |
| CAL-05 | P1 | Filtros por tipo de registro, saltar para hoje e navegação acessível por teclado/leitor de tela. |
| CAL-06 | P1 | Tratar dias sem dados, dias intencionalmente sem treino e dias incompletos como estados diferentes. |

| ID | Prioridade | Requisito |
|---|---|---|
| EXP-01 | P0 | Exportar CSV separado para peso/medidas, alimentação, sessões e séries. |
| EXP-02 | P1 | Exportar bioimpedância, recuperação, exercícios, metas, recomendações e eventos de adaptação. |
| EXP-03 | P1 | Gerar pacote ZIP com manifesto de versão e todos os CSVs; UTF-8 com BOM e separador configurável para Excel brasileiro. |
| EXP-04 | P0 | Backup JSON versionado e restauração com prévia, validação e proteção contra duplicação. |
| EXP-05 | P1 | Importadores de backups do Desafio40days e Gym-companion; mapear unidades e apontar campos ambíguos. |
| EXP-06 | P1 | Relatórios diário, semanal e mensal com objetivos, execução, tendências e fontes de recomendações. |
| EXP-07 | P2 | PDF legível e compartilhável, após a validação dos dados e do CSV. |
| EXP-08 | P1 | Exportar relatórios diários com data, completude, valores confirmados versus estimados e relação com semana/ciclo. |

Um CSV deve manter colunas estáveis, cabeçalhos em português, data ISO em campo próprio, unidade no nome da coluna ou metadado, identificador do registro e origem. Campos vazios permanecem vazios; zero somente quando foi registrado zero.

### 5.7 Perfil de rotina e aprendizado

O perfil de rotina é derivado de eventos de uso e declarações explícitas. Cada evento pode gerar um **sinal candidato**, não uma conclusão automática. Exemplos: horário de refeições, treino efetivamente realizado, adiamento, energia relatada, duração real, aceitação/rejeição de sugestões e disponibilidade informada.

| ID | Prioridade | Requisito |
|---|---|---|
| ROT-01 | P1 | Identificar janelas habituais de alimentação, treino, cansaço e disponibilidade por dia da semana. |
| ROT-02 | P1 | Separar preferência declarada, padrão observado e hipótese experimental. |
| ROT-03 | P1 | Atribuir confiança e data da última evidência a cada padrão, com decaimento ao longo do tempo. |
| ROT-04 | P1 | Evitar atualizar rotina com viagem, doença, feriado ou semana explicitamente marcada como atípica. |
| ROT-05 | P1 | Permitir que o usuário veja, corrija, fixe, apague ou suspenda uma inferência. |
| ROT-06 | P1 | Usar feedback “aceitei”, “editei”, “recusei” e “funcionou?” para ajustar próximas propostas. |
| ROT-07 | P1 | Sugerir experimentos pequenos em momentos de tempo e recuperação favoráveis. |
| ROT-08 | P1 | Exibir “Ainda não há dados suficientes” quando a confiança for baixa. |

Exemplo de item do perfil: “Terça e quinta: treino após 18h parece mais viável; observado em 6 de 8 semanas; confirmado pelo usuário”. Uma preferência explícita prevalece sobre uma inferência estatística. Dados brutos não precisam ser enviados integralmente a Gemini/Jev; o motor prepara um resumo mínimo, explicado ao usuário.

### 5.8 Motor adaptativo e IA

O sistema possui três níveis de decisão:

| Horizonte | Exemplo | Regra de aplicação |
|---|---|---|
| Durante a sessão | Ajustar descanso ou cortar acessório por falta de tempo | Aplicável na sessão, conforme consentimento configurado |
| Dia seguinte | Reagendar treino, reorganizar refeições ou propor ajuste pequeno | Prévia visível; confirmação ou preaprovação limitada |
| Revisão semanal | Alterar meta calórica, volume, divisão, objetivo ou plano-base | Confirmação explícita e, se protegido, revisão do profissional |

**Fluxo de decisão:**

1. Consolidar dados com indicador de completude e confiança.
2. Calcular tendências por métodos determinísticos documentados.
3. Aplicar restrições do usuário, regras de segurança e limites de mudança.
4. Gerar opções permitidas, incluindo **não alterar o plano** e **pedir mais dados**.
5. Usar Jev para classificar ou escolher entre opções delimitadas quando houver benefício demonstrável.
6. Usar Gemini para redigir explicação, alternativa prática ou rascunho estruturado.
7. Validar a saída com schema e regras de domínio.
8. Mostrar proposta e nível de certeza; aplicar conforme permissão.
9. Registrar versão do modelo, insumos resumidos, opção escolhida, motivo, decisão do usuário e resultado posterior.

| ID | Prioridade | Requisito |
|---|---|---|
| IA-01 | P1 | Gemini produz texto em português e rascunhos estruturados validados antes de salvar. |
| IA-02 | P1 | Jev decide apenas entre opções pré-definidas; sua probabilidade não é tratada como prova de benefício clínico. |
| IA-03 | P1 | Toda recomendação de treino/dieta tem justificativa, dados usados, fonte científica quando aplicável e nível de confiança. |
| IA-04 | P1 | Estratégia de fallback determinística se Gemini ou Jev falhar, ficar indisponível ou exceder orçamento. |
| IA-05 | P1 | Limites de frequência e magnitude de alteração para evitar oscilações diárias. |
| IA-06 | P1 | Evitar compensação punitiva após excesso calórico ou treino perdido; avaliar tendência semanal e recuperação. |
| IA-07 | P1 | Planos futuros consideram agenda, preferências, refeições habituais, equipamento e tempo disponível. |
| IA-08 | P1 | Usuário pode aceitar, editar, dispensar, desfazer e pedir explicação. |
| IA-09 | P1 | Limite de gasto por usuário e por período, rate limiting e telemetria de falhas sem conteúdo sensível. |

**Autonomia configurável:**

- **Manual:** toda adaptação pede confirmação.
- **Assistida:** usuário preaprova categorias e limites de ajustes pequenos, como deslocar refeição ou reagendar um treino dentro da semana; a Home mostra o que mudou e permite desfazer.
- **Estrutural:** mudança de objetivo, meta calórica persistente, divisão de treino ou plano profissional sempre pede confirmação explícita.

O padrão inicial será **Manual**. A categoria Assistida será opcional após o usuário compreender os exemplos e limites.

**Exemplo de dia perdido:** se um treino não ocorreu e a dieta saiu do previsto, o motor primeiro verifica tendência semanal, proteína, sono, agenda e impacto sobre próximas sessões. Pode manter o plano, reagendar treino, redistribuir parte das refeições ou sugerir caminhada. Não presume que todo excesso precisa ser compensado no dia seguinte.

## 6. Regras de personalização e evidência

### Fontes científicas

A base de evidências é uma coleção editorial versionada, com referência, população estudada, qualidade, limitações, data da revisão e regra de aplicação. Publicações novas entram em fila de revisão; não alteram automaticamente recomendações em produção. A IA consulta somente referências aprovadas e mostra de onde veio cada afirmação.

Temas iniciais: volume e frequência de treino, proximidade da falha, proteína, balanço energético, preservação de massa magra em déficit, nutrição esportiva e limites de interpretação da bioimpedância. Referências iniciais estão na seção 13.

### Restrições do motor

- Limiares concretos de kcal, proteína, volume e velocidade de mudança serão definidos por política científica versionada, com revisão especializada; números de protótipos não serão copiados como recomendações.
- Ingestão registrada incompleta não será interpretada como baixa ingestão real.
- Peso isolado e bioimpedância isolada não acionam mudança estrutural.
- Dor aguda, tontura, sinais de lesão ou relato de condição clínica geram orientação para avaliação profissional; a IA não tenta diagnosticar.
- Usuários menores de idade ou em contexto clínico específico ficam fora do motor autônomo até haver política apropriada.
- O plano profissional pode conter restrições explícitas que prevalecem sobre sugestões automáticas.
- Resultados sugeridos são estimativas; o app acompanha resultados reais e recalibra expectativas.

### Experimentos pessoais

Uma mudança experimental define hipótese, duração, métrica e condição de parada antes de começar. Exemplo: testar exercício acessório por quatro sessões e acompanhar conclusão, carga, desconforto e efeito percebido na recuperação. O sistema compara com o contexto, sinaliza dados insuficientes e oferece manter, tornar opcional, incorporar ou abandonar. A apresentação evita linguagem causal sem desenho experimental adequado.

## 7. Modelo de informação

### Entidades principais

| Entidade | Conteúdo mínimo |
|---|---|
| `UserProfile` | Identidade, unidades, fuso e preferências de interface |
| `GoalVersion` | Objetivo, prioridade, horizonte, restrições, autor e vigência |
| `RoutineSignal` | Tipo, origem, evidência, confiança, validade e status de confirmação |
| `FoodItem` | Nome, unidade, composição, fonte, versão e confiabilidade |
| `MealEntry` | Alimento/receita, quantidade, horário, origem e confirmação |
| `MealCapture` | Modalidade foto/texto/áudio, texto extraído, perguntas de revisão, consentimento e política de retenção do arquivo |
| `FoodEstimate` | Hipóteses de porção, fonte nutricional, valor central, faixa plausível e estado de confirmação |
| `BodyRecord` | Peso, medidas ou bioimpedância, método, equipamento e contexto |
| `RecoveryLog` | Sono, energia, estresse, fome e dores |
| `Exercise` | Identificador canônico, nomes, músculos e equipamento |
| `WorkoutPlanVersion` | Autor, agenda, exercícios, prescrição e proteção |
| `PlannedSession` | Snapshot do plano para uma data e adaptações aceitas |
| `PerformedSession` | Início, fim, exercícios e séries realizadas |
| `PlanDeviation` | Diferença, motivo, autoria e aprovação |
| `Recommendation` | Contexto resumido, opções, escolha, explicação, referências e resultado |
| `DailySummary` | Data local, registros, completude, totais e comparação versionada com semana/ciclo |
| `ConsentRecord` | Finalidade, estado, data e versão do texto de consentimento |

Todos os registros relevantes terão `id`, `uid`, `schemaVersion`, `createdAt`, `updatedAt`, `source`, `timezone` quando necessário e unidade explícita. Sessões e refeições usam horário local para exibição e instante UTC para ordenação. Mutação offline terá identificador idempotente; conflitos importantes serão exibidos para resolução, especialmente ao editar a mesma sessão em dois dispositivos.

### Estrutura Firestore inicial

```text
users/{uid}
  profile/main
  goals/{goalVersionId}
  consents/{consentId}
  routineSignals/{signalId}
  foodItems/{foodId}
  recipes/{recipeId}
  mealEntries/{entryId}
  mealCaptures/{captureId}
  bodyRecords/{recordId}
  recoveryLogs/{logId}
  workoutPlans/{planVersionId}
  plannedSessions/{sessionId}
  performedSessions/{sessionId}
  recommendations/{recommendationId}
  auditEvents/{eventId}
```

Agregados de painel serão derivados de registros fonte e poderão ser materializados quando desempenho exigir. Nenhum agregado substitui o registro original. Índices e granularidade final serão definidos com testes de consulta/custo.

## 8. Experiência, acessibilidade e PWA

- Interface mobile first, alvos de toque confortáveis, contraste suficiente, estados de foco, leitores de tela e tamanho de texto ajustável.
- Câmera, teclado e gravação de voz acessíveis pelo mesmo botão de refeição; permissão de microfone solicitada apenas após tocar em Áudio.
- Calendário com símbolos e texto além da cor; cada data anuncia seus tipos de registros ao leitor de tela.
- Português brasileiro em interface, mensagens, alimentos e relatórios. Siglas como RPE e RIR terão explicação curta no primeiro uso.
- Indicadores visuais sempre combinam cor, rótulo e ícone.
- Registro de séries funciona com uma mão, teclado numérico apropriado e valores anteriores pré-preenchidos para confirmação.
- Datas e vírgulas decimais são aceitas no padrão brasileiro; armazenamento numérico usa formato canônico.
- PWA com manifest, ícones, service worker e instalação “Adicionar à Tela de Início”.
- Ativos estáticos acessíveis offline. Firestore oferece cache local e sincronização posterior; imagens e recursos externos podem exigir rede. [Documentação do Firestore offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
- Timer guarda instante final e calcula tempo restante ao voltar ao app. Alertas em segundo plano dependem das capacidades/permissões do iOS; Web Push em apps adicionados à tela inicial é possível, mas será uma função complementar, não garantia de alarme local. [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- Atualização de versão da PWA não deve descartar sessão em andamento ou dados pendentes.

## 9. Arquitetura e integrações

| Camada | Tecnologia proposta | Responsabilidade |
|---|---|---|
| Interface | React, TypeScript, Vite | PWA, formulários, gráficos e cache de interface |
| Validação | Schemas compartilhados, por exemplo Zod | Entradas, respostas de IA e importações |
| Identidade | Firebase Authentication | Conta e acesso |
| Dados | Cloud Firestore | Registros e sincronização |
| Arquivos | Firebase Storage | Laudos e anexos, com regra por usuário |
| Backend | Cloud Functions 2ª geração | Orquestração, segredos, limites e chamadas de IA |
| Texto e visão | Gemini | Explicação e extração estruturada |
| Decisão delimitada | Jev/TypeSafe AI | Escolha entre opções válidas e estimativa de confiança |
| Publicação | GitHub Pages + GitHub Actions | Frontend estático e CI |

GitHub Pages entrega conteúdo estático e não executa backend; as chamadas de IA e rotinas protegidas ficam nas Functions. [GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). A chave Gemini jamais será incluída no bundle do navegador. [Google AI](https://ai.google.dev/gemini-api/docs/api-key). A API Jev retorna escolhas tipadas, não texto livre; acesso e custos serão verificados no início da integração. [TypeSafe AI](https://typesafe.ai/blog/introducing-system-one-models-and-jev).

O backend terá adaptadores `DecisionProvider` e `LanguageProvider` para permitir substituição e testes. Recomendação sem Jev deve ter caminho determinístico; resposta Gemini fora do schema não será aplicada. Chaves ficarão no Secret Manager; as Functions validarão autenticação, App Check quando habilitado, autorização, tamanho de entrada, orçamento e idempotência. [Callable Functions](https://firebase.google.com/docs/functions/callable).

### Regiões e custo

Preferência inicial: Firestore e Functions em São Paulo (`southamerica-east1`), sujeita a disponibilidade, preço e características do projeto Firebase no momento da criação. A escolha da região será registrada antes do provisionamento, pois migração posterior exige trabalho. O produto exibirá orçamento e consumo de chamadas de IA para administração, sem transformar custo interno em parte da rotina do usuário.

## 10. Privacidade, segurança e governança

Dados corporais e de saúde exigem tratamento cuidadoso. A LGPD classifica dados referentes à saúde como sensíveis. [Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm). Antes de uso público, o fluxo de consentimento, retenção, exclusão e relação com provedores externos deve passar por revisão jurídica adequada.

Requisitos:

- Regras Firestore/Storage com isolamento por `uid`, negando acesso por padrão.
- Testes de autorização no Firebase Emulator Suite.
- App Check, cotas e rate limit nas funções de IA.
- Segredos apenas no backend e proteção contra publicação acidental no repositório.
- Minimização de dados enviados a Gemini/Jev; consentimento específico para cada finalidade.
- Permissão para desativar personalização, apagar inferências de rotina e revogar consentimento para futuras chamadas.
- Exportação e exclusão de conta/dados com confirmação e prazo operacional informado.
- Logs técnicos sem laudos, refeições detalhadas ou prompts contendo dados sensíveis.
- Acesso administrativo mínimo, trilha de alterações de planos e versionamento de regras científicas.
- Armazenamento local persistente em dispositivos compartilhados explicado ao usuário; opção de limpar cache ao sair quando tecnicamente viável.

## 11. Requisitos não funcionais e qualidade

| ID | Requisito | Verificação |
|---|---|---|
| NFR-01 | Home e ações principais responsivas em iPhone atual com conexão comum | Teste em Safari/WebKit e dispositivo real |
| NFR-02 | Registro de treino/alimento disponível offline após primeiro carregamento e autenticação anterior | Teste de modo avião e sincronização posterior |
| NFR-03 | Sem perda de séries ao bloquear, alternar app ou atualizar a PWA | Testes de retomada e persistência |
| NFR-04 | Operações críticas idempotentes; nenhuma sessão duplicada na reconexão | Testes de repetição de requisição |
| NFR-05 | Cálculos de macros, agregados e progressão reproduzíveis | Testes unitários com casos-limite |
| NFR-06 | IA nunca escreve diretamente em dados do usuário sem validação e permissão | Testes de contratos e integração |
| NFR-07 | Dados de contas diferentes não são legíveis ou editáveis entre si | Testes das Security Rules |
| NFR-08 | Exportações completas e reimportáveis sem mudança de unidade | Teste de ida e volta |
| NFR-09 | Acessibilidade de navegação, contraste, foco e leitor de tela | Auditoria manual e automatizada |
| NFR-10 | Falhas de Gemini/Jev não bloqueiam registro, timer, consulta ou CSV | Testes de indisponibilidade |
| NFR-11 | Estimativas alimentares não prometem precisão sem validação; erros são medidos por modalidade e prato | Refeições pesadas de referência e análise de viés |
| NFR-12 | Áudio e fotos de refeição têm fluxo de consentimento e retenção configurável | Testes de permissão, exclusão e metadados |

Metas quantitativas de desempenho serão fixadas em testes reais no iPhone antes do lançamento, com orçamento de tamanho do bundle e limites de leituras Firestore por tela.

## 12. Entregas, dependências e critérios de aceite

### Fases

| Fase | Entrega revisável | Critério de conclusão |
|---|---|---|
| 0 | Protótipo de Home, design system, esquema, política de dados e migração | Jornadas e campos aprovados |
| 1 | Base React/TypeScript, PWA, Firebase, autenticação, CI e publicação de teste | Instala no iPhone e protege dados |
| 2 | Objetivos, corpo, recuperação e bioimpedância manual | Histórico e gráficos consistentes |
| 3 | Nutrição, catálogo, refeições, metas e receitas | Cálculos auditáveis e registro rápido |
| 3A | Primeiro adaptador Gemini para captura de refeições por foto, texto e áudio, com revisão e incerteza | Dados confirmados distinguíveis de estimativas; comparação com refeições de referência |
| 4 | Planos, sessão, timer, séries e proveniência | Treino utilizável offline e retomável |
| 5 | Calendário, relatório diário, painéis, exportações, backup e migração | Dias sem dados/parciais/revisados corretos; CSV e restauração conferidos |
| 6 | Perfil de rotina e motor determinístico | Inferências corrigíveis e ajustes explicáveis |
| 7 | Jev, Gemini para recomendações, base científica e experiências | Recomendações validadas, reversíveis e com fallback |
| 8 | Testes reais, acessibilidade, segurança, custos e lançamento | Critérios de lançamento abaixo atendidos |

### Critérios de lançamento da versão completa

1. PWA instala e abre corretamente no iPhone pela URL do GitHub Pages.
2. Usuário consegue registrar dia alimentar, treino completo e peso sem IA e sem rede, após configuração inicial.
3. Reconexão não perde dados nem duplica sessões.
4. Home mostra metas e treino do dia, com cartões clicáveis e posição estável.
5. Exercícios têm origem profissional/IA/usuário clara; plano-base permanece recuperável.
6. Perfil de rotina explica suas inferências e permite correção/exclusão.
7. Mudança diária mostra razão, dados e permissão aplicada; mudança estrutural depende de aprovação.
8. Recomendações científicas trazem referência e limites de aplicação; ausência de evidência é explicitada.
9. CSV, JSON, migração e restauração passaram por amostras reais dos dois protótipos.
10. Regras de acesso, segredos, custos e cenários de falha de IA foram testados.
11. Foto, texto e áudio produzem um rascunho editável; alimento/quantidade ambíguos são identificados e a faixa estimada é justificável.
12. Calendário e relatório diário distinguem ausência de dados, descanso planejado e registro incompleto; a relação com a meta não presume gasto energético medido.

### Dependências para a personalização final

- Relatório atual de bioimpedância e confirmação de quais registros históricos dos protótipos pertencem ao usuário e podem ser importados.
- Plano atual do personal, inclusive restrições ou observações que não devem ser alteradas automaticamente.
- Meta física, horizonte e prioridades pessoais.
- Preferência de autenticação e decisão sobre uso apenas pessoal ou abertura futura para outros usuários.
- Criação/controle das contas Firebase, Gemini, Jev e do repositório de produção.

Esses dados não são necessários para iniciar a arquitetura e as telas, mas são necessários para validar recomendações personalizadas.

## 13. Referências iniciais e fontes técnicas

Esta lista é ponto de partida da biblioteca editorial, não uma prescrição individual.

### Pesquisa e dados nutricionais

- [Currier et al., 2023 — prescrição de treino para força e hipertrofia, revisão e meta-análise de rede](https://pubmed.ncbi.nlm.nih.gov/37414459/).
- [Pelland et al., 2026 — dose-resposta de volume e frequência de treino](https://pubmed.ncbi.nlm.nih.gov/41343037/).
- [Robinson et al., 2024 — proximidade da falha e adaptação](https://pubmed.ncbi.nlm.nih.gov/38970765/).
- [Morton et al., 2018 — proteína e ganhos associados ao treino](https://pubmed.ncbi.nlm.nih.gov/28698222/).
- [ISSN, 2017 — dietas e composição corporal](https://pubmed.ncbi.nlm.nih.gov/28630601/).
- [Kyle et al., 2004 — princípios e limitações da bioimpedância](https://pubmed.ncbi.nlm.nih.gov/15380917/).
- [Moshfegh et al., 2008 — método USDA de recordatório alimentar de múltiplas passagens](https://pubmed.ncbi.nlm.nih.gov/18689367/).
- [Ho et al., 2020 — validade da avaliação alimentar por imagens](https://pubmed.ncbi.nlm.nih.gov/32839035/).
- [Amoutzopoulos et al., 2020 — ferramentas para estimar tamanho de porção](https://pubmed.ncbi.nlm.nih.gov/31999347/).
- [NEPA/UNICAMP — TACO](https://nepa.unicamp.br/publicacoes/).
- [USP — TBCA](https://www.tbca.net.br/).
- [Open Food Facts — API](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md).

### Plataforma

- [GitHub Pages — hospedagem estática](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
- [Firebase — persistência offline do Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
- [Firebase — segurança do Firestore](https://firebase.google.com/docs/firestore/security/overview).
- [Firebase — Callable Functions](https://firebase.google.com/docs/functions/callable).
- [Google AI — segurança das chaves Gemini](https://ai.google.dev/gemini-api/docs/api-key).
- [Google AI — processamento de áudio](https://ai.google.dev/gemini-api/docs/audio).
- [Google AI — processamento de imagem](https://ai.google.dev/gemini-api/docs/image-understanding).
- [TypeSafe AI — Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev).
- [WebKit — PWA e Web Push no iPhone](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## 14. Decisões propostas para aprovação

| Tema | Proposta deste PRD | Alternativa possível |
|---|---|---|
| Repositório | Novo repositório para o produto; protótipos preservados | Evoluir um dos repositórios existentes |
| Hospedagem | GitHub Pages para frontend + Firebase Functions para backend | Firebase Hosting para tudo |
| Conta | Estrutura multiusuário com uso pessoal inicial | Aplicação de conta única |
| Ajustes por IA | Modo Manual como padrão; modo Assistido optativo | Exigir confirmação em toda mudança |
| Plano profissional | Versão protegida como referência | Permitir edição direta pelo usuário |
| Dados alimentares | TACO + personalizados inicialmente; outras bases após revisão de termos | API alimentar paga desde o início |
| IA | Gemini para linguagem/extração; Jev para escolhas delimitadas | Um único provedor |

**Aceite esperado:** aprovação ou comentários neste documento. A aprovação do PRD autoriza começar a implementação das fases acordadas, mas publicação pública, provisionamento pago e tratamento dos dados reais dependerão das credenciais e decisões operacionais correspondentes.
