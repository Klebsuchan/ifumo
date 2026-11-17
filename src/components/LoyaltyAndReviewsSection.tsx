import React, { useState } from 'react';
import { Award, Star, Share2, CheckCircle2, Gift, Sparkles } from 'lucide-react';
import {
  LOYALTY_REWARDS,
  LoyaltyReward,
  PartnerStore,
  StoreReview,
} from '../data/mockCatalog';
import { getLoyaltyTier, canRedeemReward } from '../utils/commerceLogic';

interface LoyaltyAndReviewsSectionProps {
  loyaltyPoints: number;
  activeCouponCode: string | null;
  onRedeemReward: (reward: LoyaltyReward) => void;
  onShareSocialBonus: () => void;
  stores: PartnerStore[];
  reviews: StoreReview[];
  onAddReview: (storeId: string, rating: number, comment: string, authorName: string) => void;
  defaultAuthorName: string;
}

export function LoyaltyAndReviewsSection({
  loyaltyPoints,
  activeCouponCode,
  onRedeemReward,
  onShareSocialBonus,
  stores,
  reviews,
  onAddReview,
  defaultAuthorName,
}: LoyaltyAndReviewsSectionProps) {
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id || '');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [authorName, setAuthorName] = useState(defaultAuthorName || 'Cliente Ifumo');
  const [formError, setFormError] = useState('');
  const [sharedFeedback, setSharedFeedback] = useState(false);

  const tierInfo = getLoyaltyTier(loyaltyPoints);

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedComment = comment.trim();
    const trimmedAuthor = authorName.trim();

    if (trimmedAuthor.length < 2) {
      setFormError('Por favor, informe seu nome (mínimo 2 caracteres).');
      return;
    }
    if (trimmedComment.length < 8) {
      setFormError('Escreva um comentário detalhado (mínimo 8 caracteres).');
      return;
    }

    setFormError('');
    onAddReview(selectedStoreId, rating, trimmedComment, trimmedAuthor);
    setComment('');
  };

  const handleSocialShare = async () => {
    const shareData = {
      title: 'Ifumo — Delivery de Tabacarias em até 30 min',
      text: `Acabei de subir para o nível ${tierInfo.tier} no Clube Ifumo (${loyaltyPoints} pts)!`,
      url: window.location.origin,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      }
    } catch {
      // Fallback if user cancels native share sheet
    }

    onShareSocialBonus();
    setSharedFeedback(true);
    setTimeout(() => setSharedFeedback(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Gamified Loyalty Card */}
      <section className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#26272B] pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#F5A623]">
              <Award className="w-4 h-4" />
              Programa de Fidelidade Gamificado
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Clube Ifumo · Patente {tierInfo.tier}
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              Acumule 1,5 ponto a cada R$ 1 em compras nas tabacarias parceiras e troque por descontos no checkout.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-[#0B0B0D] border border-[#26272B] text-right">
              <p className="text-[11px] text-[#9CA3AF]">Saldo Disponível</p>
              <p className="text-xl font-extrabold text-[#F5A623] font-mono-tabular">
                {loyaltyPoints} pts
              </p>
            </div>

            <button
              type="button"
              onClick={handleSocialShare}
              className="px-4 py-3 rounded-2xl bg-[#F5A623] text-[#0B0B0D] text-xs font-extrabold hover:bg-[#F59E0B] transition-colors flex items-center gap-1.5 min-h-[44px]"
            >
              <Share2 className="w-4 h-4" />
              <span>{sharedFeedback ? '+50 pts Creditados!' : 'Compartilhar (+50 pts)'}</span>
            </button>
          </div>
        </div>

        {/* Tier Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white">
              Progresso para {tierInfo.nextTier || 'Patente Máxima'}
            </span>
            <span className="font-mono-tabular text-[#F5A623] font-bold">
              {tierInfo.progressPercent}% ({tierInfo.pointsToNext} pts restantes)
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#0B0B0D] overflow-hidden border border-[#26272B]">
            <div
              className="h-full bg-gradient-to-r from-[#F59E0B] to-[#F5A623] transition-all duration-300"
              style={{ width: `${tierInfo.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Rewards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
          {LOYALTY_REWARDS.map((reward) => {
            const unlocked = canRedeemReward(loyaltyPoints, reward.pointsCost);
            const isApplied = activeCouponCode === reward.code;

            return (
              <div
                key={reward.id}
                className="rounded-2xl bg-[#0B0B0D] border border-[#26272B] p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1A1B1E] text-[#F5A623] font-mono-tabular font-bold">
                      {reward.pointsCost} pts
                    </span>
                    <span className="text-[11px] text-[#9CA3AF] font-mono-tabular">
                      Restam {reward.stockBadge}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-[#F5A623] shrink-0" />
                    <span>{reward.title}</span>
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">{reward.description}</p>
                </div>

                <button
                  type="button"
                  disabled={!unlocked || isApplied}
                  onClick={() => onRedeemReward(reward)}
                  className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-colors min-h-[40px] flex items-center justify-center gap-1.5 ${
                    isApplied
                      ? 'bg-[#0E3A2F] text-[#4ADE80] border border-[#22C55E]/30'
                      : unlocked
                      ? 'bg-[#F5A623] text-[#0B0B0D] hover:bg-[#F59E0B]'
                      : 'bg-[#1A1B1E] text-[#6B7280] border border-[#26272B] cursor-not-allowed'
                  }`}
                >
                  {isApplied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Cupom {reward.code} Ativo</span>
                    </>
                  ) : unlocked ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Resgatar R$ {reward.discountBrl} OFF</span>
                    </>
                  ) : (
                    <span>Faltam {reward.pointsCost - loyaltyPoints} pts</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Store Ratings & Reviews Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#F5A623]">
              Avalie e Ganhe +25 Pontos
            </p>
            <h3 className="text-lg font-extrabold text-white mt-0.5">
              Avaliar Tabacaria Parceira
            </h3>
          </div>

          <form onSubmit={handleReviewSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="review-store-select"
                className="block text-xs font-semibold text-[#9CA3AF] mb-1"
              >
                Estabelecimento
              </label>
              <select
                id="review-store-select"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-[#F5A623]"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.neighborhood})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="review-author-input"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Seu Nome
                </label>
                <input
                  id="review-author-input"
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Ex: Lucas Andrade"
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                  Nota (1 a 5 Estrelas)
                </span>
                <div className="flex items-center gap-1 bg-[#0B0B0D] border border-[#26272B] rounded-xl px-3 py-2">
                  {[1, 2, 3, 4, 5].map((starValue) => (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => setRating(starValue)}
                      aria-label={`Dar nota ${starValue} estrelas`}
                      className="p-0.5"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          starValue <= rating
                            ? 'text-[#F5A623] fill-[#F5A623]'
                            : 'text-[#4B5563]'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-auto text-xs font-mono-tabular font-bold text-[#F5A623]">
                    {rating}.0
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="review-comment-input"
                className="block text-xs font-semibold text-[#9CA3AF] mb-1"
              >
                Comentário sobre a Entrega e Produtos
              </label>
              <textarea
                id="review-comment-input"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte como chegaram os cigarros, sedas ou charutos..."
                className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
              />
            </div>

            {formError && (
              <p className="text-xs font-semibold text-[#EF4444]">{formError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#F5A623] text-[#0B0B0D] text-xs font-extrabold hover:bg-[#F59E0B] transition-colors min-h-[44px]"
            >
              Publicar Avaliação (+25 pts)
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-white">
              Avaliações Recentes ({reviews.length})
            </h3>
            <span className="text-xs font-semibold text-[#4ADE80]">
              ★ 4.8 Média Geral Verificada
            </span>
          </div>

          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#1A1B1E] border border-[#26272B] text-center space-y-1.5">
                <p className="text-sm font-bold text-white">
                  Nenhuma avaliação publicada ainda.
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  Seja o primeiro a avaliar uma tabacaria parceira ao lado e ganhe +25 pontos reais no Clube Ifumo!
                </p>
              </div>
            ) : (
              reviews.map((rev) => (
                <article
                  key={rev.reviewId}
                  className="p-4 rounded-2xl bg-[#1A1B1E] border border-[#26272B] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white">{rev.authorName}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {rev.storeName} · {rev.createdAt}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#0B0B0D] border border-[#26272B] text-xs font-mono-tabular font-bold text-[#F5A623]">
                      ★ {rev.rating}.0
                    </span>
                  </div>
                  <p className="text-xs text-[#D1D5DB] leading-relaxed">{rev.comment}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
