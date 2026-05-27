from pathlib import Path

p = Path(__file__).resolve().parent.parent / "src/components/customer/ServiceCard.tsx"
s = p.read_text(encoding="utf-8")

old_image = """      <div className={`relative shrink-0 max-lg:w-[108px] max-lg:min-h-[120px] lg:w-full h-36 lg:h-48 ${gradientClass} overflow-hidden`}>
        {service.image ? (
          <img
            src={service.image}
            alt={displayTitle}
            loading="lazy"
            className="w-full h-full object-cover lg:group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <motion className="w-full h-full flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-[#E8B4A8]/50" aria-hidden />
          </motion>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {service.isNew && (
            <span className="bg-[#7BA889] text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
              NEW
            </span>
          )}
          {service.isFeatured && (
            <span className="bg-[#D4A89A] text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <TrendingUp className="h-3 w-3" />
              Featured
            </span>
          )}
        </motion>

        {/* Rating Badge */}
        {displayRating > 0 && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <Star className="h-4 w-4 fill-[#E8B4A8] text-[#E8B4A8]" />
            <span className="text-sm font-semibold text-[#2D2D2D]">{displayRating.toFixed(1)}</span>
            {ratingCount > 0 && (
              <span className="text-xs text-[#6B6B6B]">({ratingCount})</span>
            )}
          </motion>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          className={`absolute top-3 left-3 p-2 rounded-full shadow-sm transition-all ${
            isFavorited
              ? 'bg-red-500 text-white'
              : 'bg-white/80 backdrop-blur-sm text-gray-600 hover:bg-white'
          } ${isToggling ? 'opacity-50' : ''}`}
        >
          <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
        </button>
      </motion>"""

old_image = old_image.replace("motion", "div")

new_image = """      <div className={`relative shrink-0 max-lg:w-[108px] max-lg:min-h-[120px] lg:w-full h-36 lg:h-48 ${gradientClass} overflow-hidden`}>
        {service.image ? (
          <img
            src={service.image}
            alt={displayTitle}
            loading="lazy"
            className="w-full h-full object-cover lg:group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center min-h-[120px] lg:min-h-0">
            <Sparkles className="w-8 h-8 lg:w-10 lg:h-10 text-[#E8B4A8]/50" aria-hidden />
          </div>
        )}

        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1 pointer-events-none">
          <div className="flex flex-col gap-1 pointer-events-auto min-w-0">
            {service.isFeatured && (
              <span className="bg-[#D4A89A] text-white text-[10px] lg:text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm w-fit">
                <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                Featured
              </span>
            )}
            {service.isNew && (
              <span className="bg-[#7BA889] text-white text-[10px] lg:text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm w-fit">
                NEW
              </span>
            )}
          </div>
          {displayRating > 0 && (
            <div className="bg-white/95 backdrop-blur-sm px-1.5 py-0.5 lg:px-2.5 lg:py-1 rounded-full flex items-center gap-0.5 lg:gap-1.5 shadow-sm pointer-events-auto shrink-0">
              <Star className="h-3 w-3 lg:h-4 lg:w-4 fill-[#E8B4A8] text-[#E8B4A8]" />
              <span className="text-[10px] lg:text-sm font-semibold text-[#2D2D2D]">{displayRating.toFixed(1)}</span>
              {ratingCount > 0 && (
                <span className="hidden lg:inline text-xs text-[#6B6B6B]">({ratingCount})</span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleFavorite}
          className={`absolute bottom-2 right-2 lg:top-3 lg:left-3 lg:bottom-auto lg:right-auto p-1.5 lg:p-2 rounded-full shadow-sm transition-all pointer-events-auto ${
            isFavorited
              ? 'bg-red-500 text-white'
              : 'bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white'
          } ${isToggling ? 'opacity-50' : ''}`}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${isFavorited ? 'fill-current' : ''}`} />
        </button>
      </div>"""

if old_image not in s:
    raise SystemExit("image block not found")
s = s.replace(old_image, new_image, 1)

old_content = """      {/* Content */}
      <div className="p-4">
        {/* Category Tag */}
        <span className="inline-block px-2.5 py-1 bg-[#F8F6F4] text-[#6B6B6B] text-xs font-medium rounded-lg mb-2">
          {service.category}
        </span>

        {/* Title */}
        <h3 className="font-semibold text-[#2D2D2D] mb-2 line-clamp-2
          group-hover:text-[#D4A89A] transition-colors duration-200">
          {displayTitle}
        </h3>

        {/* Description */}
        {service.description && (
          <p className="text-sm text-[#6B6B6B] mb-3 line-clamp-2">
            {service.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-sm text-[#6B6B6B] mb-3">
          {service.duration && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#D4A89A]" />
              <span>{service.duration} min</span>
            </div>
          )}
          {service.provider?.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#D4A89A]" />
              <span className="truncate">{service.provider.location}</span>
            </div>
          )}
        </div>

        {/* Price and Provider */}
        <motion className="flex items-center justify-between pt-3 border-t border-[#E8E4E0]">
          <div>
            {service.provider && (
              <p className="text-xs text-[#9B9B9B] mb-0.5">by {service.provider.name}</p>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-[#2D2D2D]">AED {displayPrice}</span>
              <span className="text-xs text-[#9B9B9B]">/ service</span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="px-4 py-2 bg-[#E8B4A8] text-white font-medium text-sm rounded-lg
              hover:bg-[#D4A89A] hover:shadow-[0_4px_20px_rgba(232,180,168,0.25)]
              active:scale-95
              transition-all duration-200"
          >
            Book
          </button>
        </div>
      </div>"""

old_content = old_content.replace("motion", "motion")

new_content = """      <div className="flex flex-col flex-1 min-w-0 p-3 lg:p-4 max-lg:justify-between">
        <div>
          <span className="inline-block px-2 py-0.5 bg-[#F8F6F4] text-[#6B6B6B] text-[10px] lg:text-xs font-medium rounded-md mb-1.5 lg:mb-2">
            {service.category}
          </span>

          <h3 className="font-semibold text-[#2D2D2D] text-sm lg:text-base mb-1 lg:mb-2 line-clamp-2 leading-snug group-hover:text-[#D4A89A] transition-colors">
            {displayTitle}
          </h3>

          {service.description && (
            <p className="hidden lg:block text-sm text-[#6B6B6B] mb-3 line-clamp-2">
              {service.description}
            </p>
          )}

          {service.duration && (
            <div className="flex items-center gap-1 text-xs text-[#6B6B6B] mb-2 lg:hidden">
              <Clock className="h-3.5 w-3.5 text-[#D4A89A]" />
              <span>{service.duration} min</span>
            </div>
          )}

          <div className="hidden lg:flex items-center gap-4 text-sm text-[#6B6B6B] mb-3">
            {service.duration && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#D4A89A]" />
                <span>{service.duration} min</span>
              </motion>
            )}
            {service.provider?.location && (
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="h-4 w-4 text-[#D4A89A] shrink-0" />
                <span className="truncate">{service.provider.location}</span>
              </motion>
            )}
          </motion>
        </motion>

        <div className="flex items-center justify-between gap-2 pt-2 lg:pt-3 border-t border-[#E8E4E0] max-lg:mt-1">
          <div className="min-w-0">
            {service.provider && (
              <p className="text-[10px] lg:text-xs text-[#9B9B9B] mb-0.5 truncate hidden lg:block">by {service.provider.name}</p>
            )}
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-base lg:text-xl font-bold text-[#2D2D2D]">AED {displayPrice}</span>
              <span className="text-[10px] lg:text-xs text-[#9B9B9B]">/ service</span>
            </motion>
          </motion>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="shrink-0 px-3.5 py-2 lg:px-4 lg:py-2 bg-[#E8B4A8] text-white font-medium text-xs lg:text-sm rounded-lg hover:bg-[#D4A89A] active:scale-95 transition-all"
          >
            Book
          </button>
        </motion>
      </motion>"""

new_content = new_content.replace("motion", "div")

if old_content not in s:
    raise SystemExit("content block not found")
s = s.replace(old_content, new_content, 1)

p.write_text(s, encoding="utf-8")
print("OK")
