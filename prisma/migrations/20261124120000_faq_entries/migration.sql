-- Tira-dúvidas do site: perguntas e respostas prontas, editáveis em /backstage/tira-duvidas.

-- AlterEnum
ALTER TYPE "audit_entity" ADD VALUE 'FAQ';

-- CreateTable
CREATE TABLE "faq_entries" (
    "id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT[],
    "show_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "link_label" TEXT,
    "link_url" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "faq_entries"
  ADD CONSTRAINT "faq_entries_question_len" CHECK (char_length(btrim("question")) BETWEEN 3 AND 160),
  ADD CONSTRAINT "faq_entries_answer_len" CHECK (char_length(btrim("answer")) BETWEEN 3 AND 1500);

-- Perguntas iniciais. A equipe pode editar/apagar tudo pelo painel.
-- {cultos}, {endereco}, {whatsapp}, {pix} e {instagram} são trocados pelo bot
-- pelos dados atuais cadastrados no painel (Cultos e Aparência).
INSERT INTO "faq_entries" ("id", "question", "answer", "keywords", "show_whatsapp", "link_label", "link_url", "is_featured", "sort_order", "updated_at") VALUES
(gen_random_uuid(),
 'É minha primeira vez. Como faço pra visitar?',
 E'Seja muito bem-vindo(a)! Você pode vir em qualquer um dos nossos cultos, não precisa de inscrição. Se programe, traga sua família e convide um amigo!\n\nNossos cultos:\n{cultos}\n\nPra conhecer a igreja de perto, participe também do Café com o Pastor, feito especialmente pra quem está chegando.',
 ARRAY['primeira vez','visitar','visita','visitante','visitantes','conhecer a igreja','sou novo','sou nova','chegando','frequentar','ir na igreja','como funciona'],
 false, 'Como chegar', '/visite-nos', true, 0, CURRENT_TIMESTAMP),

(gen_random_uuid(),
 'O que é o Café com o Pastor?',
 E'É um momento que preparamos com muito carinho pra receber de perto quem chegou há pouco tempo ou está nos visitando pela primeira vez. Queremos ouvir a sua história, compartilhar a nossa, tirar suas dúvidas sobre a igreja e viver um tempo de comunhão ao redor da mesa.\n\nAcontece em algumas sextas-feiras, às 20h. Pra participar, mande uma mensagem e garanta sua vaga!',
 ARRAY['cafe com o pastor','cafe com pastor','cafe','conhecer o pastor','falar com o pastor'],
 true, 'Ver agenda', '/agenda', true, 1, CURRENT_TIMESTAMP),

(gen_random_uuid(),
 'O que é o GFC?',
 E'GFC é o Grupo Familiar de Comunhão: o nosso momento de nos reunirmos como uma verdadeira família pra partilhar a Palavra, orar uns pelos outros, rir, chorar e crescer juntos na fé.\n\nOs GFCs se reúnem às quintas-feiras, às 20h. Quer participar de um? Fale com a gente que indicamos um GFC pra você. Não caminhe sozinho!',
 ARRAY['gfc','gfcs','grupo familiar','grupo familiar de comunhao','celula','celulas','pequeno grupo','grupo de comunhao','grupo nas casas'],
 true, NULL, NULL, true, 2, CURRENT_TIMESTAMP),

(gen_random_uuid(),
 'Como faço pra me inscrever num evento?',
 E'Quando um evento tem inscrição, o link aparece na página dele na agenda. Se não tiver link, é só mandar uma mensagem pra gente que a equipe te ajuda.',
 ARRAY['inscricao','inscricoes','inscrever','inscrevo','me inscrever','vaga','vagas','garantir vaga','reservar'],
 true, 'Ver agenda', '/agenda', false, 3, CURRENT_TIMESTAMP),

(gen_random_uuid(),
 'Posso levar crianças?',
 E'Claro! Traga sua família, as crianças são muito bem-vindas.',
 ARRAY['crianca','criancas','filho','filhos','filha','filhas','bebe','infantil','levar meus filhos'],
 false, 'Ver ministérios', '/ministerios', false, 4, CURRENT_TIMESTAMP),

(gen_random_uuid(),
 'Como posso pedir oração?',
 E'Vai ser uma alegria orar por você! Mande seu pedido de oração pra gente e, se puder, venha a um dos nossos cultos:\n{cultos}',
 ARRAY['oracao','oracoes','orar','pedido de oracao','pedir oracao','ore por mim','orem por mim','intercessao'],
 true, NULL, NULL, false, 5, CURRENT_TIMESTAMP);
